import { IResolvers } from '@graphql-tools/utils';
import { Context } from 'apollo-server-core';
import mongoose from 'mongoose';
import { Helpers } from '../api/v3/helpers';

type ConfigFunc = (helpers: Helpers) => Configuration;

interface Configuration {
  database: Database;
}

type DatabaseFunc = (helpers: Helpers) => Database;

interface Database {
  connection: {
    username: string;
    password: string;
    host: string;
    database: string;
    options: string;
  };
  collections: Collection[];
}

interface Collection {
  name: string;
  canPublish?: boolean;
  withPermissions?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: Record<string, unknown>;
  actionAccess: (context: Context, doc?: unknown) => CollectionPermissions;
}

type TeamsType = Record<string, string>;
type UsersType = Record<string, mongoose.Types.ObjectId>;

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
  bypassDocPermissions?: CollectionPermissionsType;
}

export type {
  ConfigFunc,
  Configuration,
  Database,
  DatabaseFunc,
  Collection,
  CollectionPermissions,
  CollectionPermissionsType,
  CollectionPermissionsActions,
  TeamsType,
  UsersType,
};
