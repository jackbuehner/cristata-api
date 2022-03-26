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

const database: DatabaseFunc = (): Database => ({
  collections: [
    users(),
    teams(),
    satire(),
    articles(),
    shorturls(),
    settings(),
    photoRequests(),
    photos(),
    flush(),
    externalAccounts(),
  ],
});

export type { Collection, CollectionPermissions, CollectionPermissionsActions } from '../types/config';
export { database };
