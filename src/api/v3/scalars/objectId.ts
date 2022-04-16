import { GraphQLScalarType } from 'graphql';
import mongoose from 'mongoose';

const objectId = new GraphQLScalarType({
  name: 'ObjectID',
  description: 'mongoose ObjectID scalar type',
  serialize(ObjectID: mongoose.Types.ObjectId | 0 | '0') {
    try {
      // consider values of 0 as the team or user that represents ANY, or '000000000000000000000000'
      if (ObjectID == 0) ObjectID = new mongoose.Types.ObjectId('000000000000000000000000');
      return new mongoose.Types.ObjectId(ObjectID).toHexString(); // Convert outgoing ObjectID to hex string
    } catch {
      return null;
    }
  },
  parseValue(_id) {
    return new mongoose.Types.ObjectId(_id); // Convert incoming hex string id to mongoose ObjectID
  },
});

export { objectId };
