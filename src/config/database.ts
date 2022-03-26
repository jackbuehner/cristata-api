import dotenv from 'dotenv';
import { Database, DatabaseFunc } from '../types/config';
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

export type { Collection, CollectionPermissions, CollectionPermissionsActions } from '../types/config';
export { database };
