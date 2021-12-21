/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloServer as Apollo, ExpressContext } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer, ContextFunction } from 'apollo-server-core';
import { Server } from 'http';
import ws from 'ws';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { Application } from 'express';
import { GraphQLScalarType, execute, subscribe } from 'graphql';
import { config } from './config';
import mongoose from 'mongoose';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphqls2s } from 'graphql-s2s';
import { IProfile } from './passport';
import { merge } from 'merge-anything';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { PubSub } from 'graphql-subscriptions';
import { corsConfig } from './middleware/cors';
import { converObjIsoDatesToDates } from './utils/converObjIsoDatesToDates';
import { convertStringsToObjIds } from './utils/convertStringsToObjIds';
export const gql = (s: TemplateStringsArray): string => `${s}`;

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO date string scalar type',
  serialize(value) {
    return new Date(value).toISOString();
  },
  parseValue(value) {
    return new Date(value).toISOString();
  },
});

const mongooseObjectIdScalar = new GraphQLScalarType({
  name: 'ObjectID',
  description: 'mongoose ObjectID scalar type',
  serialize(ObjectID: mongoose.Types.ObjectId) {
    return ObjectID.toHexString(); // Convert outgoing ObjectID to hex string
  },
  parseValue(_id) {
    return new mongoose.Types.ObjectId(_id); // Convert incoming hex string id to mongoose ObjectID
  },
});

const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON string',
  serialize(value) {
    return JSON.stringify(value);
  },
  parseValue(value) {
    return converObjIsoDatesToDates(convertStringsToObjIds(JSON.parse(value)));
  },
});

const voidScalar = new GraphQLScalarType({
  name: 'Void',
  description: 'Void custom scalar',
  serialize: () => null,
  parseValue: () => null,
  parseLiteral: () => null,
});

const coreTypeDefs = gql`
  scalar Date
  scalar ObjectID
  scalar JSON
  scalar Void

  type Paged<T> {
    docs: [T]!
    totalDocs: Int
    limit: Int
    page: Int
    totalPages: Int
    pagingCounter: Int
    hasPrevPage: Boolean
    hasNextPage: Boolean
    prevPage: Int
    nextPage: Int
  }

  type Subscription {
    void: Void 
  }
`;

const collectionTypeDefs = gql`
  type Collection {
    _id: ObjectID!
    timestamps: CollectionTimestamps
    people: CollectionPeople
    hidden: Boolean!
    locked: Boolean!
    history: [CollectionHistory]
  }

  type WithPermissions {
    permissions: CollectionPermissions!
  }

  type CollectionPermissions {
    teams: [String]!
    users: [Int]!
  }

  type PublishableCollection inherits Collection {
    timestamps: PublishableCollectionTimestamps
    people: PublishableCollectionPeople
  }

  type CollectionTimestamps {
    created_at: Date!
    modified_at: Date!
  }

  type PublishableCollectionTimestamps inherits CollectionTimestamps {
    published_at: Date!
    updated_at: Date!
  }

  type CollectionPeople {
    created_by: User
    modified_by: [User]
    last_modified_by: User
    watching: [User]
  }

  type PublishableCollectionPeople inherits CollectionPeople {
    published_by: [User]
    last_published_by: User
  }

  type CollectionHistory {
    type: String!
    user: User
    at: Date!
  }

  type CollectionActionAccess {
    get: Boolean!
    create: Boolean!
    modify: Boolean!
    hide: Boolean!
    lock: Boolean!
    watch: Boolean!
    publish: Boolean # not all collections allow publishing
    delete: Boolean!
  }

  type CollectionActivity {
    _id: ObjectID!,
    name: String!,
    in: String!,
    user: User, # the user id in the database is sometimes missing or corrupted
    action: String!,
    at: Date!, #// TODO: this might not actually always be there
  }

  type Query {
    """
      Get the recent activity in the specified collections
      """
      collectionActivity(limit: Int!, collections: [String], exclude: [String], page: Int): Paged<CollectionActivity>
  }
`;

const coreResolvers = {
  Date: dateScalar,
  ObjectID: mongooseObjectIdScalar,
  JSON: jsonScalar,
  Void: voidScalar,
  Query: {
    collectionActivity: async (_, { limit, collections, exclude, page }, context: Context) => {
      let collectionNames = config.database.collections.map((col) => col.name);
      if (collections) collectionNames = collectionNames.filter((name) => collections.includes(name));
      else if (exclude) collectionNames = collectionNames.filter((name) => !exclude.includes(name));

      const collectionNamesPluralized = collectionNames.map((name) => mongoose.pluralize()(name));

      const Model = mongoose.model(collectionNames[0]);

      const pipeline: mongoose.PipelineStage[] = [
        { $addFields: { in: collectionNamesPluralized[0] } },
        ...collectionNamesPluralized.map((collectionName) => ({
          $unionWith: {
            coll: collectionName,
            pipeline: [{ $addFields: { in: collectionName } }],
          },
        })),
        { $unwind: { path: '$history' } },
        {
          $project: {
            // _id: projected by default
            in: 1,
            name: 1,
            'permissions.teams': 1,
            'permissions.users': 1,
            user: '$history.user',
            action: '$history.type',
            at: '$history.at',
          },
        },
        { $sort: { at: -1 } },
        {
          $match: context.profile.teams.includes(process.env.GITHUB_ORG_ADMIN_TEAM_ID)
            ? {}
            : {
                $or: [
                  { 'permissions.teams': { $in: context.profile.teams } },
                  { 'permissions.users': parseInt(context.profile.id) },
                ],
              },
        },
        { $limit: limit },
      ];

      const aggregate = Model.aggregate(pipeline);

      // @ts-expect-error aggregatePaginate DOES exist.
      // The types for the plugin have not been updated for newer versions of mongoose.
      return Model.aggregatePaginate(aggregate, { page, limit });
    },
  },
  CollectionActivity: {
    user: ({ user }) => getUsers(user),
  },
};

async function getUsers(userIds: string | string[]) {
  // if it is undefined
  if (!userIds) return null;
  // if it is an array of github ids
  if (Array.isArray(userIds)) {
    return await Promise.all(
      userIds.map(async (github_id) => await mongoose.model('User').findOne({ github_id }))
    );
  }
  // if it just a single github id
  const github_id = userIds;
  return await mongoose.model('User').findOne({ github_id });
}

const collectionPeopleResolvers = {
  created_by: ({ created_by }) => getUsers(created_by),
  modified_by: ({ modified_by }) => getUsers(modified_by),
  last_modified_by: ({ last_modified_by }) => getUsers(last_modified_by),
  watching: ({ watching }) => getUsers(watching),
};

const publishableCollectionPeopleResolvers = {
  ...collectionPeopleResolvers,
  published_by: ({ published_by }) => getUsers(published_by),
  last_published_by: ({ last_published_by }) => getUsers(last_published_by),
};

const collectionResolvers = {
  CollectionPeople: collectionPeopleResolvers,
  PublishableCollectionPeople: publishableCollectionPeopleResolvers,
  CollectionHistory: {
    user: ({ user }) => getUsers(user),
  },
};

// initialize a subscription server for graphql subscriptions
const apolloWSS = new ws.Server({ noServer: true, path: '/v3' });

// create publish-subscribe class for managing subscriptions
const pubsub = new PubSub();

/**
 * Starts the Apollo GraphQL server.
 *
 * @param app express app
 * @param server http server
 */
async function apollo(app: Application, server: Server): Promise<void> {
  try {
    const typeDefs = [
      graphqls2s.transpileSchema(
        [
          coreTypeDefs,
          collectionTypeDefs,
          ...config.database.collections.map((collection) => collection.typeDefs),
        ].join()
      ),
    ];

    const resolvers = merge(
      coreResolvers,
      collectionResolvers,
      ...config.database.collections.map((collection) => collection.resolvers)
    );

    // create the base executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // add auth info to context
    const context: ContextFunction<ExpressContext, Context> = ({ req }) => {
      return {
        config: config,
        isAuthenticated: req.isAuthenticated(),
        profile: req.user as IProfile,
      };
    };

    // initialize apollo
    const apollo = new Apollo({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer: server }),
        ApolloServerPluginLandingPageGraphQLPlayground({
          settings: {
            'general.betaUpdates': false,
            'editor.theme': 'dark',
            'editor.cursorShape': 'line',
            'editor.reuseHeaders': true,
            'tracing.hideTracingResponse': true,
            'queryPlan.hideQueryPlanResponse': true,
            'editor.fontSize': 14,
            'editor.fontFamily': `'Dank Mono', 'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace`,
            'request.credentials': 'include',
          },
        }),
        {
          // close the websocket subscription server when apollo server closed
          async serverWillStart() {
            return {
              async drainServer() {
                apolloWSS.close();
              },
            };
          },
        },
      ],
      context,
    });

    // attach subscription handler to subscriptionServer
    SubscriptionServer.create(
      {
        schema,
        execute,
        subscribe,
      },
      apolloWSS
    );

    // required logic for integrating with Express
    await apollo.start();
    apollo.applyMiddleware({ app, path: '/v3', cors: corsConfig });
  } catch (error) {
    console.error(error);
  }
}

interface Context {
  config: typeof config;
  isAuthenticated: boolean;
  profile?: IProfile;
}

export type { Context };
export {
  apollo,
  apolloWSS,
  collectionPeopleResolvers,
  collectionTypeDefs,
  getUsers,
  publishableCollectionPeopleResolvers,
  pubsub,
};
