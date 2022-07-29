/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { ApolloServer as Apollo } from 'apollo-server-express';
import { Router } from 'express';
import { execute, subscribe } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { context } from './api/v3/graphql/context';
import { makeGraphSchema } from './api/v3/graphql/makeGraphSchema';
import { CloseWebsocketServerStop, GraphQLPlayground, LogErrorsToConsole } from './api/v3/graphql/plugins';
import { collectionResolvers } from './api/v3/resolvers';
import { collectionTypeDefs } from './api/v3/typeDefs';
import Cristata from './Cristata';
import { corsConfig } from './middleware/cors';

// create publish-subscribe class for managing subscriptions
const pubsub = new PubSub();

/**
 * Starts the Apollo GraphQL server.
 */
async function apollo(
  cristata: Cristata,
  tenant: string,
  root = false
): Promise<[Router, () => Promise<void>] | Error> {
  const server = cristata.hocuspocus.httpServer;
  const wss = cristata.apolloWss[tenant];
  const config = cristata.config[tenant];
  const collections = config.collections;

  try {
    // create the base executable schema
    const schema = makeGraphSchema(collections);

    // initialize apollo
    const apollo = new Apollo({
      schema,
      introspection: config.introspection,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer: server }),
        GraphQLPlayground(),
        CloseWebsocketServerStop({ wss }),
        LogErrorsToConsole(),
      ],
      context: (ec) => context({ ...ec, __cristata: { cristata, tenant } }),
    });

    // attach subscription handler to subscriptionServer
    SubscriptionServer.create({ schema, execute, subscribe }, wss);

    // start the server
    await apollo.start();

    // required middleware for integrating with express
    const apolloMiddleware = apollo.getMiddleware({ path: root ? `/v3` : `/v3/${tenant}`, cors: corsConfig() });

    return [apolloMiddleware, apollo.stop];
  } catch (error) {
    console.error(error);

    if (error.message) {
      return new Error(error.message);
    }
    return new Error('unknown error');
  }
}

const collectionPeopleResolvers = collectionResolvers.CollectionPeople;
const publishableCollectionPeopleResolvers = collectionResolvers.PublishableCollectionPeople;

export type { Context } from './api/v3/graphql/context';
export { apollo, collectionPeopleResolvers, collectionTypeDefs, publishableCollectionPeopleResolvers, pubsub };
