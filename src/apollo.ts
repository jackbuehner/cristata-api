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
import { execute, subscribe } from 'graphql';
import { graphqls2s } from 'graphql-s2s';
import { PubSub } from 'graphql-subscriptions';
import { Server } from 'http';
import { merge } from 'merge-anything';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import ws from 'ws';
import { collectionResolvers, configurationResolvers, coreResolvers, s3Resolvers } from './api/v3/resolvers';
import { collectionTypeDefs, configurationTypeDefs, coreTypeDefs, s3TypeDefs } from './api/v3/typeDefs';
import { corsConfig } from './middleware/cors';
import { IDeserializedUser } from './passport';
import { Configuration } from './types/config';

// create publish-subscribe class for managing subscriptions
const pubsub = new PubSub();

/**
 * Starts the Apollo GraphQL server.
 *
 * @param app express app
 * @param server http server
 */
async function apollo(
  app: Application,
  server: Server,
  wss: ws.Server,
  tenant: string,
  config: Configuration,
  root = false
): Promise<void> {
  try {
    const typeDefs = [
      graphqls2s.transpileSchema(
        [
          coreTypeDefs,
          collectionTypeDefs,
          s3TypeDefs,
          configurationTypeDefs,
          ...config.collections.map((collection) => collection.typeDefs),
        ].join()
      ),
    ];

    const resolvers = merge(
      coreResolvers,
      s3Resolvers,
      collectionResolvers,
      configurationResolvers,
      ...config.collections.map((collection) => collection.resolvers)
    );

    // create the base executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // add auth info to context
    const context: ContextFunction<ExpressContext, Context> = ({ req }) => {
      const isAuthenticated = req.isAuthenticated() && (req.user as IDeserializedUser).tenant === tenant;
      const profile = req.user as IDeserializedUser;
      return { config, isAuthenticated, profile, tenant };
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
                const { config, db, ...prunedContext } = requestContext.context;
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

    // required logic for integrating with Express
    await apollo.start();
    apollo.applyMiddleware({ app, path: root ? `/v3` : `/v3/${tenant}`, cors: corsConfig() });
  } catch (error) {
    console.error(error);
  }
}

interface Context {
  config: Configuration;
  isAuthenticated: boolean;
  profile?: IDeserializedUser;
  tenant: string;
}

const collectionPeopleResolvers = collectionResolvers.CollectionPeople;
const publishableCollectionPeopleResolvers = collectionResolvers.PublishableCollectionPeople;

export type { Context };
export { apollo, collectionPeopleResolvers, collectionTypeDefs, publishableCollectionPeopleResolvers, pubsub };
