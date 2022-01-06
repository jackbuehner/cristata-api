/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
  ContextFunction,
} from 'apollo-server-core';
import { ApolloServer as Apollo, ExpressContext } from 'apollo-server-express';
import { GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';
import { Application } from 'express';
import { execute, GraphQLScalarType, subscribe } from 'graphql';
import { graphqls2s } from 'graphql-s2s';
import { PubSub } from 'graphql-subscriptions';
import { Server } from 'http';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import ws from 'ws';
import { config } from './config';
import { Teams } from './config/database';
import { corsConfig } from './middleware/cors';
import { IDeserializedUser } from './passport';
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
    users: [User]!
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
    """
    Only for collectins that allow publishing
    """
    publish: Boolean
    """
    Only for the users collection
    """
    deactivate: Boolean
    delete: Boolean!
  }

  type CollectionActivity {
    _id: ObjectID!,
    name: String,
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
          $match: context.profile.teams.includes(Teams.ADMIN)
            ? {}
            : {
                $or: [
                  { 'permissions.teams': { $in: context.profile.teams } },
                  { 'permissions.users': context.profile._id },
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
  CollectionPermissions: {
    users: ({ users }) => getUsers(users),
  },
};

async function getUsers(_ids: mongoose.Types.ObjectId | mongoose.Types.ObjectId[]) {
  // if it is undefined
  if (!_ids) return null;
  // if it is an array of ObjectId
  if (Array.isArray(_ids)) {
    return await Promise.all(_ids.map(async (_id) => await mongoose.model('User').findById(_id)));
  }
  // if it just a single ObjectId
  const _id = _ids;
  return await mongoose.model('User').findById(_id);
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
        profile: req.user as IDeserializedUser,
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
        {
          // log errors
          async requestDidStart(): Promise<GraphQLRequestListener | void> {
            return {
              async didEncounterErrors(requestContext: GraphQLRequestContext) {
                console.error('Apollo::didEncounterErrors::request', requestContext.request);
                console.error('Apollo::didEncounterErrors::context', requestContext.context);
                console.error('Apollo::didEncounterErrors::errors', requestContext.errors);
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
  profile?: IDeserializedUser;
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
