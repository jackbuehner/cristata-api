import dotenv from 'dotenv';
import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';
import { Collection, DatabaseFunc } from '../types/config';
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

const database: DatabaseFunc<Collection | GenCollectionInput> = () => ({
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
