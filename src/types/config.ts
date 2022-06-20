import { IResolvers } from '@graphql-tools/utils';
import * as fluentIcons from '@fluentui/react-icons';
import { GenSchemaInput, SchemaDefType } from '../api/v3/helpers/generators/genSchema';
import { GenCollectionInput } from '../api/v3/helpers/generators/genCollection';

interface Configuration<CT = Collection> {
  /**
   * An array of origins that are permitted to receive data from the server.
   *
   * This only applies to browsers. Other clients, including other servers,
   * may not be affected by this limit.
   *
   * [Read more on MDN.](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
   */
  collections: Array<CT>;
  secrets: {
    aws?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    fathom?: {
      siteId: string;
      dashboardPassword: string;
    };
  };
  tokens?: Array<{
    name: string;
    token: string;
    expires: string | 'never'; // ISO date OR 'never'
    scope: {
      admin: true;
    };
  }>;
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
  dashboard: {
    collectionRows: Array<{
      /**
       * Information for the header row for the collection row.
       * Contains things like the label and the icon.
       */
      header: {
        /**
         * The label of this collection row. It does not need to be the same
         * as the collection name.
         */
        label: string;
        /**
         * The icon to appear in front of the label. Any icon from
         * `@fluentui/react-icons` is valid.
         */
        icon: keyof typeof fluentIcons;
      };
      /**
       * The parts of the the location to navigate upon clicking an item in the
       * row. The location is a string concatenation of `idPrefix + _id + idSuffix`,
       * where `_id` is the unique identifier of the item that is clicked.
       */
      to: {
        /**
         * Prepend the `_id` with this string.
         *
         * For example: `'/cms/item/articles/'`
         */
        idPrefix: string;
        /**
         * Append the `_id` with this string.
         *
         * For example: `'?fs=force&comments=1'`
         */
        idSuffix: string;
      };
      /**
       * A valid GraphQL query string to retrieve the needed data.
       *
       * Be sure to use a named query so the query does not disturb
       * existing caches for the collections in the CMS table view.
       */
      query: string;
      /**
       * The path to the array containing the documents.
       */
      arrPath: string;
      /**
       * The keys corresponding to the data displayed in the collection row.
       */
      dataKeys: {
        /**
         * The identifier for the document.
         * This is usually a field with an ObjectId.
         */
        _id: string;
        /**
         * The name or title of the document.
         */
        name: string;
        /**
         * Description or other caption to appear under the document name.
         */
        description?: string;
        /**
         * Photo associated with the document.
         */
        photo?: string;
        /**
         * Name of the person who last modified the document.
         */
        lastModifiedBy: string;
        /**
         * Last modified at.
         */
        lastModifiedAt: string;
      };
    }>;
  };
}

interface Collection {
  name: string;
  canPublish?: boolean;
  withPermissions?: boolean;
  typeDefs: string;
  resolvers: IResolvers<unknown, Record<string, unknown>, Record<string, unknown>, unknown>;
  schemaFields: Record<string, unknown>;
  schemaDef: SchemaDefType;
  generationOptions: GenSchemaInput['options'];
  actionAccess: CollectionPermissions;
  by: GenSchemaInput['by'];
  raw: GenCollectionInput;
  textIndexFieldNames: string[];
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
