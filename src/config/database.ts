import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Database, DatabaseFunc, TeamsType, UsersType } from '../types/config';
import {
  articles,
  externalAccounts,
  flush,
  photoRequests,
  photos,
  satire,
  settings,
  shorturls,
  teams,
  users,
} from './collections';

// load environmental variables
dotenv.config();

const database: DatabaseFunc = (helpers): Database => ({
  connection: {
    username: process.env.MONGO_DB_USERNAME,
    password: process.env.MONGO_DB_PASSWORD,
    host: `editor0.htefm.mongodb.net`,
    database: process.env.MONGO_DB_NAME,
    options: `retryWrites=true&w=majority`,
  },
  collections: [
    users(helpers),
    teams(helpers),
    satire(helpers),
    articles(helpers),
    shorturls(helpers),
    settings(helpers),
    photoRequests(helpers),
    photos(helpers),
    flush(helpers),
    externalAccounts(helpers),
  ],
});

const Teams: TeamsType = {
  ADMIN: '000000000000000000000001',
  BOARD: '000000000000000000000002',
  MANAGING_EDITOR: '000000000000000000000003',
  COPY_EDITOR: '000000000000000000000004',
  SHORTURL: '000000000000000000000008',
  FLUSH: '000000000000000000000009',
  ANY: '000000000000000000000000',
};

const Users: UsersType = {
  ANY: new mongoose.Types.ObjectId('000000000000000000000000'),
};

export type { Collection, CollectionPermissions, CollectionPermissionsActions } from '../types/config';
export { database, Teams, Users };
