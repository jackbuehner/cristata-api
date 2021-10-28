import { ApolloServer as Apollo, gql } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { Server } from 'http';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { Application } from 'express';

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  type Query {
    placeholder: undefined
  }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    placeholder: () => undefined,
  },
};

/**
 * Starts the Apollo GraphQL server.
 *
 * @param app express app
 * @param server http server
 */
async function apollo(app: Application, server: Server): Promise<void> {
  // initialize apollo
  const apollo = new Apollo({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
      ApolloServerPluginLandingPageGraphQLPlayground,
    ],
  });

  // required logic for integrating with Express
  await apollo.start();
  apollo.applyMiddleware({ app, path: '/v3' });
}

export { apollo };
