import { ConfigFunc, Configuration } from '../types/config';
import { database } from './database';

const config: ConfigFunc = (): Configuration => ({
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
