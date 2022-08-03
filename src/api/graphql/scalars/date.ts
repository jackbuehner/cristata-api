import { GraphQLScalarType } from 'graphql';

const date = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO date string scalar type',
  serialize(value) {
    return new Date(value).toISOString();
  },
  parseValue(value) {
    return new Date(value).toISOString();
  },
});

export { date };
