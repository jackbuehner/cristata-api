import { IResolvers } from '@graphql-tools/utils';
import dotenv from 'dotenv';

// load environmental variables
dotenv.config();

const database = {
  connection: {
    username: process.env.MONGO_DB_USERNAME,
    password: process.env.MONGO_DB_PASSWORD,
    host: `editor0.htefm.mongodb.net`,
    database: process.env.MONGO_DB_NAME,
    options: `retryWrites=true&w=majority`,
  },
  collections: [],
};

interface Collection {
  name: string;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: Record<string, unknown>;
}

export type { Collection };
export { database };
