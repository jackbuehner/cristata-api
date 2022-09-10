import { converObjIsoDatesToDates, convertStringsToObjIds } from '@cristata/utils';
import { GraphQLScalarType } from 'graphql';

const json = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON string',
  serialize(value) {
    return JSON.stringify(value);
  },
  parseValue(value) {
    const parsed = JSON.parse(value);
    if (parsed.skipAdditionalParsing === true) {
      return parsed;
    }
    return converObjIsoDatesToDates(convertStringsToObjIds(parsed));
  },
});

export { json };
