import { GraphQLScalarType } from 'graphql';

const Void = new GraphQLScalarType({
  name: 'Void',
  description: 'Void custom scalar',
  serialize: () => null,
  parseValue: () => null,
  parseLiteral: () => null,
});

export { Void };
