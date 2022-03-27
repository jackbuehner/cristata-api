import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';
import { Collection, Configuration } from '../types/config';
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

const config: Configuration<Collection | GenCollectionInput> = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:4000',
    'https://thepaladin.cristata.app',
    'https://api.thepaladin.cristata.app',
    'https://thepaladin.dev.cristata.app',
    'https://api.thepaladin.dev.cristata.app',
    'https://thepaladin.news',
    'https://new.thepaladin.news',
    'https://dev.thepaladin.news',
    'https://4000-gray-guineafowl-g1n8eq87.ws-us30.gitpod.io',
    'https://3000-green-tarantula-v58yhlbx.ws-us38.gitpod.io',
    'https://3000-jackbuehner-cristatawebs-8vze2ewl1dp.ws-us38.gitpod.io',
  ],
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
    database: process.env.MONGO_DB_NAME || 'db_2',
    options: `retryWrites=true&w=majority`,
  },
  defaultSender: 'Cristata <noreply@thepaladin.news>',
  defaultTeams: [
    { name: 'Board', slug: 'board', id: '000000000000000000000002' },
    { name: 'Managing Editors', slug: 'managing-editors', id: '000000000000000000000003' },
    { name: 'Editing Team', slug: 'editing-team', id: '000000000000000000000004' },
    { name: 'Social Media', slug: 'social-media', id: '000000000000000000000007' },
    { name: 'Short URL Creators', slug: 'shorturl', id: '000000000000000000000008' },
    { name: 'The Royal Flush', slug: 'flusher', id: '000000000000000000000009' },
  ],
  minimumClientVersion: '0.7.0',
  tenantDisplayName: 'The Paladin Network',
};

export { config };
