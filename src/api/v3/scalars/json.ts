import { GraphQLScalarType } from 'graphql';
import { converObjIsoDatesToDates } from '../../../utils/converObjIsoDatesToDates';
import { convertStringsToObjIds } from '../../../utils/convertStringsToObjIds';

const json = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON string',
  serialize(value) {
    return JSON.stringify(value);
  },
  parseValue(value) {
    return converObjIsoDatesToDates(convertStringsToObjIds(JSON.parse(value)));
  },
});

export { json };
