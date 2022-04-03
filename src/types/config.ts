import { IResolvers } from '@graphql-tools/utils';
import * as fluentIcons from '@fluentui/react-icons';

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
   * The teams that should always exist in the teams collection.
   *
   * The Administrators and Managing Editors teams will always be created:
   * ```js
   * {
   *   name: 'Administrators',
   *   slug: 'admin',
   *   id: '000000000000000000000001',
   * },
   * {
   *   name: 'Managing Editors',
   *   slug: 'managing-editors',
   *   _id: '000000000000000000000003',
   * }
   * ```
   */
  defaultTeams?: Array<{
    /**
     * The name of the team.
     */
    name: string;
    /**
     * The slug of the team.
     * It should be alphanumeric with no other characters.
     * Substitute spaces with hyphens.
     */
    slug: string;
    /**
     * A hexadecimal representation of a MongoDB ObjectId.
     * It should be 32 characters long.
     */
    id: string;
  }>;
  /**
   * The lowest version number permitted for clients connecting via websockets.
   */
  minimumClientVersion: string;
  /**
   * The display name for the tenant of this Cristata instance.
   * Use the name of your organization.
   * This name appears in email messages.
   */
  tenantDisplayName: string;
  /**
   * Whether GraphQL introspection is enabled.
   *
   * _default: `true` unless in production_
   */
  introspection?: boolean;
  navigation: {
    main: Array<{
      label: string;
      icon: keyof typeof fluentIcons;
      to: string | { first: string };
      isHidden?: boolean | { notInTeam: string | string[] };
      subNav?: 'forceCollapseForRoute' | 'hideMobile';
    }>;
    sub: {
      [key: string]: Array<{
        label: string;
        items: Array<{
          label: string;
          icon: keyof typeof fluentIcons;
          to: string;
          isHidden?: boolean | { notInTeam: string | string[] };
        }>;
      }>;
    };
  };
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

interface ReturnedMainNavItem extends Omit<Configuration['navigation']['main'][0], 'isHidden'> {
  to: string;
}

interface SubNavGroup {
  label: string;
  items: Array<{
    label: string;
    icon: keyof typeof fluentIcons;
    to: string;
    isHidden?: boolean | { notInTeam: string | string[] };
  }>;
}

interface ReturnedSubNavGroup extends SubNavGroup {
  items: Omit<SubNavGroup['items'][0], 'isHidden'>[];
}

export type {
  Configuration,
  Collection,
  CollectionPermissions,
  CollectionPermissionsType,
  CollectionPermissionsActions,
  ReturnedMainNavItem,
  ReturnedSubNavGroup,
  SubNavGroup,
};
