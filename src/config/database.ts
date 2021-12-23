import { IResolvers } from '@graphql-tools/utils';
import dotenv from 'dotenv';
import { GitHubTeamNodeID, GitHubUserID } from '../mongodb/db';
import {
  users,
  teams,
  satire,
  articles,
  shorturls,
  settings,
  photoRequests,
  photos,
  flush,
} from './collections';

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
  collections: [users, teams, satire, articles, shorturls, settings, photoRequests, photos, flush],
};

const Teams = {
  ADMIN: 'MDQ6VGVhbTQ2NDI0MTc=',
  BOARD: 'MDQ6VGVhbTQ3MzA5ODU=',
  MANAGING_EDITOR: 'MDQ6VGVhbTQ5MDMxMTY=',
  COPY_EDITOR: 'MDQ6VGVhbTQ4MzM5MzU=',
  STAFF_WRITER: 'MDQ6VGVhbTQ5MDMxMTg=',
  CONTRIBUTOR: 'MDQ6VGVhbTQ5MDMxMjA=',
  SHORTURL: 'T_kwDOBCVTT84ATx29',
  ANY: 'any',
};

const Users = {
  ANY: 0,
};

interface Collection {
  name: string;
  canPublish?: boolean;
  withPermissions?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: (users: typeof Users, teams: typeof Teams) => Record<string, unknown>;
  permissions: (users: typeof Users, teams: typeof Teams) => CollectionPermissions;
}

type CollectionPermissionsType = {
  teams: GitHubTeamNodeID[];
  users: GitHubUserID[];
};

type CollectionPermissionsActions = keyof CollectionPermissions;

interface CollectionPermissions {
  get: CollectionPermissionsType;
  create: CollectionPermissionsType;
  modify: CollectionPermissionsType;
  hide: CollectionPermissionsType;
  lock: CollectionPermissionsType;
  watch: CollectionPermissionsType;
  publish?: CollectionPermissionsType;
  delete: CollectionPermissionsType;
}

export type { Collection, CollectionPermissions, CollectionPermissionsActions };
export { database, Teams, Users };
