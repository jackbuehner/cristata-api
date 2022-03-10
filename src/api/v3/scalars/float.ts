import { UserInputError } from 'apollo-server-errors';
import { GraphQLScalarType, Kind } from 'graphql';
import mongoose from 'mongoose';

const float = new GraphQLScalarType({
  name: 'Float',
  description: 'Float',
  serialize(Decimal128: mongoose.Types.Decimal128) {
    return parseFloat(Decimal128.toString()); // Convert outgoing Decimal128 to regular number
  },
  parseValue(num: number) {
    return new mongoose.Types.Decimal128(num.toString()); // Convert incoming number to mongoose Decimal128
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    throw new UserInputError('Provided value is not a float');
  },
});

export { float };
