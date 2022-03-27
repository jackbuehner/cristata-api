import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';
import { Collection, ConfigFunc, Configuration } from '../types/config';
import articles from './articles.collection.json';
import externalAccounts from './externalAccounts.collection.json';
import flush from './flush.collection.json';
import photoRequests from './photoRequests.collection.json';
import photos from './photos.collection.json';
import satire from './satire.collection.json';
import settings from './settings.collection.json';
import shorturls from './shorturls.collection.json';
import teams from './teams.collection.json';
import { users } from './users';

const config: ConfigFunc<Collection | GenCollectionInput> = (): Configuration<
  Collection | GenCollectionInput
> => ({
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
  connection: {
    username: process.env.MONGO_DB_USERNAME,
    password: process.env.MONGO_DB_PASSWORD,
    host: `editor0.htefm.mongodb.net`,
    database: process.env.MONGO_DB_NAME,
    options: `retryWrites=true&w=majority`,
  },
});

export { config };
