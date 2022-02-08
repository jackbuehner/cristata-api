import { IResolvers } from '@graphql-tools/utils';
import { Context } from 'apollo-server-core';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
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
  ADMIN: '000000000000000000000001',
  BOARD: '000000000000000000000002',
  MANAGING_EDITOR: '000000000000000000000003',
  COPY_EDITOR: '000000000000000000000004',
  SHORTURL: '000000000000000000000008',
  FLUSH: '000000000000000000000009',
  ANY: '000000000000000000000000',
};

const Users = {
  ANY: new mongoose.Types.ObjectId('000000000000000000000000'),
};

interface Collection {
  name: string;
  canPublish?: boolean;
  withPermissions?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: (users: typeof Users, teams: typeof Teams) => Record<string, unknown>;
  actionAccess: (
    users: typeof Users,
    teams: typeof Teams,
    context: Context,
    doc?: unknown
  ) => CollectionPermissions;
}

type CollectionPermissionsType = {
  teams: string[];
  users: mongoose.Types.ObjectId[];
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
  deactivate?: CollectionPermissionsType; // users only
  delete: CollectionPermissionsType;
}

export type { Collection, CollectionPermissions, CollectionPermissionsActions };
export { database, Teams, Users };
