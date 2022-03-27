import { IResolvers } from '@graphql-tools/utils';

interface Configuration<CT = Collection> {
  /**
   * An array of origins that are permitted to receive data from the server.
   *
   * This only applies to browsers. Other clients, including other servers,
   * may not be affected by this limit.
   *
   * [Read more on MDN.](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
   */
  allowedOrigins: string[];
  collections: Array<CT>;
  connection: {
    username: string;
    password: string;
    host: string;
    database: string;
    options: string;
  };
  /**
   * The default sender name and email to be used by AWS SES when no other
   * email is specified.
   *
   * e.g. 'Cristata <noreply@cristata.app>'
   */
  defaultSender: string;
  /**
   * The lowest version number permitted for clients connecting via websockets.
   */
  minimumClientVersion: string;
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
  users: Array<string | 0>;
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
  Configuration,
  Collection,
  CollectionPermissions,
  CollectionPermissionsType,
  CollectionPermissionsActions,
};
