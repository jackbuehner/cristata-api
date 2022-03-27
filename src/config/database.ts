import dotenv from 'dotenv';
import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';
import { Collection, DatabaseFunc } from '../types/config';
import articles from './collections/articles.collection.json';
import externalAccounts from './collections/externalAccounts.collection.json';
import flush from './collections/flush.collection.json';
import photoRequests from './collections/photoRequests.collection.json';
import photos from './collections/photos.collection.json';
import satire from './collections/satire.collection.json';
import settings from './collections/settings.collection.json';
import shorturls from './collections/shorturls.collection.json';
import teams from './collections/teams.collection.json';
import { users } from './collections/users';

// load environmental variables
dotenv.config();

const database: DatabaseFunc<Collection | GenCollectionInput> = () => ({
  collections: [
    articles as unknown as GenCollectionInput,
    externalAccounts as unknown as GenCollectionInput,
    flush as unknown as GenCollectionInput,
    photoRequests as unknown as GenCollectionInput,
    photos as unknown as GenCollectionInput,
    satire as unknown as GenCollectionInput,
    settings as unknown as GenCollectionInput,
    shorturls as unknown as GenCollectionInput,
    teams as unknown as GenCollectionInput,
    users(),
  ],
});

export type { Collection, CollectionPermissions, CollectionPermissionsActions } from '../types/config';
export { database };
