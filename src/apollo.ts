import { ApolloServer as Apollo, ExpressContext } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer, AuthenticationError, ContextFunction } from 'apollo-server-core';
import { Server } from 'http';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { Application } from 'express';
import { GraphQLScalarType } from 'graphql';
import { config } from './config';
import mongoose from 'mongoose';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphqls2s } from 'graphql-s2s';
import { IProfile } from './passport';
import { merge } from 'merge-anything';
export const gql = (s: TemplateStringsArray): string => `${s}`;

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO date string scalar type',
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
    return JSON.parse(value);
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

  type Query {
    _: Boolean
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
    user: User!
    at: Date!
  }
`;

const coreResolvers = {
  Date: dateScalar,
  ObjectID: mongooseObjectIdScalar,
  JSON: jsonScalar,
  Void: voidScalar,
};

async function getUsers(userIds: string | string[]) {
  // if it is an array of github ids
  if (Array.isArray(userIds)) {
    return userIds.map(async (github_id) => await mongoose.model('User').findOne({ github_id }));
  }
  // if it just a single github id
  const github_id = userIds;
  return await mongoose.model('User').findOne({ github_id });
}

const collectionResolvers = {
  CollectionPeople: {
    created_by: ({ created_by }) => getUsers(created_by),
    modified_by: ({ modified_by }) => getUsers(modified_by),
    last_modified_by: ({ last_modified_by }) => getUsers(last_modified_by),
    watching: ({ watching }) => getUsers(watching),
  },
  PublishableCollectionPeople: {
    created_by: ({ created_by }) => getUsers(created_by),
    modified_by: ({ modified_by }) => getUsers(modified_by),
    last_modified_by: ({ last_modified_by }) => getUsers(last_modified_by),
    published_by: ({ published_by }) => getUsers(published_by),
    last_published_by: ({ last_published_by }) => getUsers(last_published_by),
    watching: ({ watching }) => getUsers(watching),
  },
};

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
      if (!req.isAuthenticated()) throw new AuthenticationError('you must be logged in');
      if (!req.user) throw new AuthenticationError('your account could not be found');
      return {
        profile: req.user as IProfile,
        config: config,
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
      ],
      context,
    });

    // required logic for integrating with Express
    await apollo.start();
    apollo.applyMiddleware({ app, path: '/v3' });
  } catch (error) {
    console.error(error);
  }
}

interface Context {
  profile: IProfile;
  config: typeof config;
}

export type { Context };
export { apollo, collectionTypeDefs };