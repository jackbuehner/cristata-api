import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';
import { Collection, ConfigFunc } from '../types/config';
import { database } from './database';

const config: ConfigFunc<Collection | GenCollectionInput> = () => ({
  connection: {
    username: process.env.MONGO_DB_USERNAME,
    password: process.env.MONGO_DB_PASSWORD,
    host: `editor0.htefm.mongodb.net`,
    database: process.env.MONGO_DB_NAME,
    options: `retryWrites=true&w=majority`,
  },
  database: database(),
});

export { config };
