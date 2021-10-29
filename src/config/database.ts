import { IResolvers } from '@graphql-tools/utils';
import dotenv from 'dotenv';
import { GitHubTeamNodeID, GitHubUserID } from '../mongodb/db';

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
  collections: [],
};

const Teams = {
  ADMIN: 'MDQ6VGVhbTQ2NDI0MTc=',
  ANY: 'any',
};

const Users = {
  ANY: 0,
};

interface Collection {
  name: string;
  canPublish?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: Record<string, unknown>;
  permissions: (users: typeof Users, teams: typeof Teams) => CollectionPermissions;
}

type CollectionPermissionsType = {
  teams: GitHubTeamNodeID[];
  users: GitHubUserID[];
};

type CollectionPermissionsActions =
  | 'get'
  | 'create'
  | 'modify'
  | 'hide'
  | 'lock'
  | 'watch'
  | 'publish'
  | 'delete';

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
