/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
  ContextFunction,
} from 'apollo-server-core';
import { ApolloServer as Apollo, ExpressContext } from 'apollo-server-express';
import { GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';
import { Router } from 'express';
import { execute, subscribe } from 'graphql';
import { graphqls2s } from 'graphql-s2s';
import { PubSub } from 'graphql-subscriptions';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import {
  analyticsResolvers,
  collectionResolvers,
  configurationResolvers,
  coreResolvers,
  s3Resolvers,
} from './api/v3/resolvers';
import {
  analyticsTypeDefs,
  collectionTypeDefs,
  configurationTypeDefs,
  coreTypeDefs,
  s3TypeDefs,
} from './api/v3/typeDefs';
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
): Promise<[Router, () => Promise<void>]> {
  const server = cristata.hocuspocus.httpServer;
  const wss = cristata.apolloWss[tenant];
  const config = cristata.config[tenant];
  const collections = config.collections;
  const restartApollo = () => cristata.restartApollo(tenant);

  try {
    const typeDefs = [
      graphqls2s.transpileSchema(
        [
          coreTypeDefs,
          collectionTypeDefs,
          s3TypeDefs,
          configurationTypeDefs,
          analyticsTypeDefs,
          ...collections.map((collection) => collection.typeDefs),
        ].join()
      ),
    ];

    const resolvers = merge(
      coreResolvers,
      s3Resolvers,
      collectionResolvers,
      configurationResolvers,
      analyticsResolvers,
      ...collections.map((collection) => collection.resolvers)
    );

    // create the base executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

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
                wss.close();
              },
            };
          },
        },
        {
          // log errors
          async requestDidStart(): Promise<GraphQLRequestListener | void> {
            return {
              async didEncounterErrors(requestContext: GraphQLRequestContext) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { http, ...prunedRequest } = requestContext.request;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { config, db, cristata, restartApollo, ...prunedContext } = requestContext.context;
                console.error('Apollo::didEncounterErrors::prunedRequest', prunedRequest);
                console.error('Apollo::didEncounterErrors::prunedContext', prunedContext);
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
      wss
    );

    // start the server
    await apollo.start();

    // required middleware for integrating with express
    const apolloMiddleware = apollo.getMiddleware({ path: root ? `/v3` : `/v3/${tenant}`, cors: corsConfig() });

    return [apolloMiddleware, apollo.stop];
  } catch (error) {
    console.error(error);
  }
}

interface Context {
  config: Configuration;
  isAuthenticated: boolean;
  profile?: IDeserializedUser;
  tenant: string;
  cristata: Cristata;
  restartApollo: () => Promise<void>;
}

const collectionPeopleResolvers = collectionResolvers.CollectionPeople;
const publishableCollectionPeopleResolvers = collectionResolvers.PublishableCollectionPeople;

export type { Context };
export { apollo, collectionPeopleResolvers, collectionTypeDefs, publishableCollectionPeopleResolvers, pubsub };
