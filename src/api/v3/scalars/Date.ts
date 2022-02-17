import { GraphQLScalarType } from 'graphql';

const Date = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO date string scalar type',
  serialize(value) {
    return new Date(value).toISOString();
  },
  parseValue(value) {
    return new Date(value).toISOString();
  },
});

export { Date };
