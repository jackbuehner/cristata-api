import { GraphQLScalarType } from 'graphql';
import mongoose from 'mongoose';

const objectId = new GraphQLScalarType({
  name: 'ObjectID',
  description: 'mongoose ObjectID scalar type',
  serialize(ObjectID: mongoose.Types.ObjectId) {
    return ObjectID.toHexString(); // Convert outgoing ObjectID to hex string
  },
  parseValue(_id) {
    return new mongoose.Types.ObjectId(_id); // Convert incoming hex string id to mongoose ObjectID
  },
});

export { objectId };
