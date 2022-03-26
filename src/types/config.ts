import { IResolvers } from '@graphql-tools/utils';
import mongoose from 'mongoose';

type ConfigFunc<CT = Collection> = () => Configuration<CT>;

interface Configuration<CT = Collection> {
  connection: {
    username: string;
    password: string;
    host: string;
    database: string;
    options: string;
  };
  database: Database<CT>;
}

type DatabaseFunc<CT = Collection> = () => Database<CT>;

interface Database<CT = Collection> {
  collections: Array<CT>;
}

interface Collection {
  name: string;
  canPublish?: boolean;
  withPermissions?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: Record<string, unknown>;
  actionAccess: CollectionPermissions;
}

type CollectionPermissionsType = {
  teams: Array<string | 0>;
  users: Array<mongoose.Types.ObjectId | string>;
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
};
