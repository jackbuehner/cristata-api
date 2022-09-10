/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { ApolloServer as Apollo } from 'apollo-server-express';
import { Router } from 'express';
import { corsConfig } from '../../app/middleware/cors';
import Cristata from '../../Cristata';
import { GraphQLPlayground, LogErrorsToConsole, LogErrorsToLogtail } from '../plugins';
import { collectionResolvers } from '../resolvers';
import { collectionTypeDefs } from '../typeDefs';
import { context } from './context';
import { makeGraphSchema } from './makeGraphSchema';

/**
 * Starts the Apollo GraphQL server.
 */
async function apollo(
  cristata: Cristata,
  tenant: string,
  root = false
): Promise<[Router, () => Promise<void>] | Error> {
  const server = cristata.server;
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
        LogErrorsToConsole(),
        LogErrorsToLogtail(),
      ],
      context: (ec) => context({ ...ec, __cristata: { cristata, tenant } }),
    });

    // start the server
    await apollo.start();

    // required middleware for integrating with express
    const apolloMiddleware = apollo.getMiddleware({ path: root ? `/v3` : `/v3/${tenant}`, cors: corsConfig() });

    return [apolloMiddleware, apollo.stop];
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message) {
      return error;
    }
    return new Error('unknown error');
  }
}

const collectionPeopleResolvers = collectionResolvers.CollectionPeople;
const publishableCollectionPeopleResolvers = collectionResolvers.PublishableCollectionPeople;

export type { Context } from './context';
export { apollo, collectionPeopleResolvers, collectionTypeDefs, publishableCollectionPeopleResolvers };
