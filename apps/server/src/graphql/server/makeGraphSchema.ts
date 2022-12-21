import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLSchema } from 'graphql';
import { graphqls2s } from 'graphql-s2s';
import { merge } from 'merge-anything';
import { Collection } from '../../types/config';
import {
  coreResolvers,
  s3Resolvers,
  collectionResolvers,
  configurationResolvers,
  analyticsResolvers,
  billingResolvers,
} from '../resolvers';
import {
  coreTypeDefs,
  collectionTypeDefs,
  s3TypeDefs,
  configurationTypeDefs,
  analyticsTypeDefs,
  billingTypeDefs,
} from '../typeDefs';

/**
 * Builds a GraphQL schema from the API types and resolvers
 * and the derived collection types and resolvers.
 */
function makeGraphSchema(collections: Collection[]): GraphQLSchema {
  const typeDefs = [
    graphqls2s.transpileSchema(
      [
        coreTypeDefs,
        collectionTypeDefs,
        s3TypeDefs,
        configurationTypeDefs,
        analyticsTypeDefs,
        billingTypeDefs,
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
    billingResolvers,
    ...collections.map((collection) => collection.resolvers)
  );

  // create the base executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  return schema;
}

export { makeGraphSchema };
