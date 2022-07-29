/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloServerPluginDrainHttpServer, ContextFunction } from 'apollo-server-core';
import { ApolloServer as Apollo, ExpressContext } from 'apollo-server-express';
import { Router } from 'express';
import { execute, subscribe } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import mongoose from 'mongoose';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeGraphSchema } from './api/v3/graphql/makeGraphSchema';
import { CloseWebsocketServerStop, GraphQLPlayground, LogErrorsToConsole } from './api/v3/graphql/plugins';
import { collectionResolvers } from './api/v3/resolvers';
import { collectionTypeDefs } from './api/v3/typeDefs';
import Cristata from './Cristata';
import { corsConfig } from './middleware/cors';
import { IDeserializedUser } from './passport';
import { Configuration } from './types/config';

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
  const restartApollo = () => cristata.restartApollo(tenant);

  try {
    // create the base executable schema
    const schema = makeGraphSchema(collections);

    // add auth info to context
    const context: ContextFunction<ExpressContext, Context> = ({ req }) => {
      if (req.headers.authorization) {
        const [type, token] = req.headers.authorization.split(' ');
        if (type === 'app-token') {
          const matchedToken = config.tokens?.find(({ token: appToken }) => appToken === token);
          const isAuthenticated = !!matchedToken;
          const profile: IDeserializedUser = {
            _id: new mongoose.Types.ObjectId('000000000000000000000000'),
            email: 'token@cristata.app',
            methods: ['local'],
            name: 'TOKEN_' + matchedToken.name,
            next_step: '',
            provider: 'local',
            teams: matchedToken.scope.admin === true ? ['000000000000000000000001'] : [],
            tenant: tenant,
            two_factor_authentication: false,
            username: 'TOKEN_' + matchedToken.name,
          };
          return { config, isAuthenticated, profile, tenant, cristata, restartApollo };
        }
      }

      const isAuthenticated = req.isAuthenticated() && (req.user as IDeserializedUser).tenant === tenant;
      const profile = req.user as IDeserializedUser;
      return { config, isAuthenticated, profile, tenant, cristata, restartApollo };
    };

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
      context,
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

interface Context {
  config: Configuration;
  isAuthenticated: boolean;
  profile?: IDeserializedUser;
  tenant: string;
  cristata: Cristata;
  restartApollo: () => Promise<Error | void>;
}

const collectionPeopleResolvers = collectionResolvers.CollectionPeople;
const publishableCollectionPeopleResolvers = collectionResolvers.PublishableCollectionPeople;

export type { Context };
export { apollo, collectionPeopleResolvers, collectionTypeDefs, publishableCollectionPeopleResolvers, pubsub };
