import { GraphQLScalarType } from 'graphql';

const date = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO date string scalar type',
  serialize(value) {
    return new Date(value || '0001-01-01T01:00:00.000+00:00').toISOString();
  },
  parseValue(value) {
    return new Date(value || '0001-01-01T01:00:00.000+00:00').toISOString();
  },
});

export { date };
