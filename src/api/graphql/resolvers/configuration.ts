import { ForbiddenError } from 'apollo-server-errors';
import { ObjectId } from 'mongoose';
import pluralize from 'pluralize';
import { Context } from '../server';
import { constructCollections, convertCollectionToCollectionInput } from '../../utils/constructCollections';
import {
  Collection,
  Configuration,
  ReturnedMainNavItem,
  ReturnedSubNavGroup,
  SubNavGroup,
} from '../../types/config';
import { camelToDashCase } from '../../utils/camelToDashCase';
import { capitalize } from '../../utils/capitalize';
import { hasKey } from '../../utils/hasKey';
import { isObject } from '../../utils/isObject';
import helpers, { requireAuthentication } from '../helpers';
import { GenCollectionInput } from '../helpers/generators/genCollection';
import { TenantDB } from '../../mongodb/TenantDB';

const configuration = {
  Query: {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    configuration: (_: unknown, __: unknown, context: Context) => {
      return {
        dashboard: {},
        navigation: {},
        security: {},
        collection: async ({ name }: { name: string }) => {
          const collection = context.config.collections.find((col) => col.name === name);

          if (collection) {
            return {
              name,
              canPublish: collection.canPublish,
              withPermissions: collection.withPermissions,
              schemaDef: collection.schemaDef,
              generationOptions: collection.generationOptions,
              by: {
                one:
                  collection.by && hasKey('one', collection.by)
                    ? collection.by.one[0]
                    : collection.by?.[0] || '_id',
                many:
                  collection.by && hasKey('many', collection.by)
                    ? collection.by.many[0]
                    : collection.by?.[0] || '_id',
              },
              raw: collection.raw,
            };
          }

          // if the collection does not exist, return null
          return null;
        },
        collections: () =>
          context.config.collections.filter((col) => col.name !== 'User' && col.name !== 'Team'),
      };
    },
  },
  Mutation: {
    setRawConfigurationCollection: async (
      _: unknown,
      { name, raw }: { name: string; raw?: GenCollectionInput },
      context: Context
    ): Promise<GenCollectionInput> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const appDb = new TenantDB('app');
      const appConn = await appDb.connect();

      const tenantsCollection = appConn.db.collection<{
        _id: ObjectId;
        name: string;
        config: Configuration;
      }>('tenants');

      if (!raw) {
        raw = {
          name,
          canPublish: false,
          publicRules: false,
          withPermissions: false,
          schemaDef: {
            name: {
              type: 'String',
              modifiable: true,
              required: true,
              textSearch: true,
              field: { label: 'Name', order: 1 },
              column: { sortable: true, order: 1, width: 300 },
            },
          },
          actionAccess: {
            get: { teams: ['000000000000000000000001'], users: [] },
            create: { teams: ['000000000000000000000001'], users: [] },
            modify: { teams: ['000000000000000000000001'], users: [] },
            hide: { teams: ['000000000000000000000001'], users: [] },
            lock: { teams: ['000000000000000000000001'], users: [] },
            archive: { teams: ['000000000000000000000001'], users: [] },
            watch: { teams: ['000000000000000000000001'], users: [] },
            delete: { teams: ['000000000000000000000001'], users: [] },
          },
        };
      }

      // construct the new config
      const backup: Configuration<Collection | GenCollectionInput> = JSON.parse(JSON.stringify(context.config));
      const copy: Configuration<Collection | GenCollectionInput> = JSON.parse(JSON.stringify(backup));
      const colIndex = copy.collections.findIndex((col) => col.name === name);
      if (colIndex === -1) copy.collections.push(raw);
      else copy.collections[colIndex] = raw;

      // update the config in the cristata instance
      copy.collections.forEach((col) => convertCollectionToCollectionInput(col));
      context.cristata.config[context.tenant] = {
        ...copy,
        collections: constructCollections(copy.collections, context.tenant),
      };
      const ret = await context.restartApollo();

      // something went wrong
      if (ret instanceof Error) {
        // restore the old config
        backup.collections.forEach((col) => convertCollectionToCollectionInput(col));
        context.cristata.config[context.tenant] = {
          ...backup,
          collections: constructCollections(backup.collections, context.tenant),
        };

        // throw the error
        throw ret;
      }

      // clear the models so that models based on an old version of the config
      // are not used with the new collection configs
      const tenantDB = new TenantDB(context.tenant, context.config.collections);
      for (const modelName in tenantDB.models.keys()) {
        tenantDB.models.delete(modelName);
      }

      if (colIndex === -1) {
        // create the collection in the database
        await tenantsCollection.findOneAndUpdate(
          { name: context.tenant },
          { $push: { 'config.collections': raw } },
          { returnDocument: 'after' }
        );
      } else {
        // update the collection config in the database
        await tenantsCollection.findOneAndUpdate(
          { name: context.tenant, 'config.collections.name': name },
          { $set: { 'config.collections.$': raw } },
          { returnDocument: 'after' }
        );
      }

      // return the value that is now available in the cristata instance
      return raw;
    },
    deleteCollection: async (_: unknown, { name }: { name: string }, context: Context): Promise<void> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const appDb = new TenantDB('app');
      const appConn = await appDb.connect();

      const tenantsCollection = appConn.db.collection<{
        _id: ObjectId;
        name: string;
        config: Configuration;
      }>('tenants');

      // construct the new config
      const backup: Configuration<Collection | GenCollectionInput> = JSON.parse(JSON.stringify(context.config));
      const copy: Configuration<Collection | GenCollectionInput> = JSON.parse(JSON.stringify(backup));
      const removed = copy.collections.filter((col) => col.name !== name);

      // update the config in the cristata instance
      context.cristata.config[context.tenant] = {
        ...copy,
        collections: constructCollections(removed, context.tenant),
      };
      const ret = await context.restartApollo();

      // something went wrong
      if (ret instanceof Error) {
        // restore the old config
        context.cristata.config[context.tenant] = {
          ...copy,
          collections: constructCollections(backup.collections, context.tenant),
        };

        // throw the error
        throw ret;
      }

      // delete the collection from the tenant config
      await tenantsCollection.findOneAndUpdate(
        { name: context.tenant, 'config.collections.name': name },
        { $unset: { 'config.collections.$': '' } },
        { returnDocument: 'after' }
      );

      // drop the collection from the database
      const tenantDB = new TenantDB(context.tenant, context.config.collections);
      const conn = await tenantDB.connect();
      conn.dropCollection(name);
    },
    setSecret: async (_: unknown, { key, value }: { key: string; value: Collection }, context: Context) => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantsCollection = context.cristata.tenantsCollection;

      // update the config in the database
      const res = await tenantsCollection?.findOneAndUpdate(
        { name: context.tenant },
        { $set: { [`config.secrets.${key}`]: value } },
        { returnDocument: 'after' }
      );

      // update the config in the cristata instance
      if (res?.value?.config) {
        context.cristata.config[context.tenant] = {
          ...res.value.config,
          collections: constructCollections(res.value.config.collections, context.tenant),
        };
        await context.restartApollo();
      }

      // return the value that is now available in the cristata instance
      return value;
    },
  },
  ConfigurationDashboard: {
    collectionRows: (
      _: unknown,
      __: unknown,
      context: Context
    ): Configuration['dashboard']['collectionRows'] => {
      try {
        return context.config.dashboard.collectionRows;
      } catch {
        return [];
      }
    },
  },
  ConfigurationNavigation: {
    main: (_: unknown, __: unknown, context: Context): ReturnedMainNavItem[] => {
      return context.config.navigation.main
        .filter((item) => {
          if (isObject(item.isHidden)) {
            if (typeof item.isHidden.notInTeam === 'string') {
              return context.profile?.teams.includes(item.isHidden.notInTeam);
            }
            return item.isHidden.notInTeam.some((team) => context.profile?.teams.includes(team));
          }
          return item.isHidden !== true;
        })
        .map((item): ReturnedMainNavItem => {
          delete item.isHidden;
          if (isObject(item.to)) {
            return {
              ...item,
              to: filterHidden(context.config.navigation.sub[item.to.first], context)[0]?.items?.[0]?.to || '/',
            };
          }
          return { ...item, to: item.to };
        });
    },
    sub: async (_: unknown, { key }: { key: string }, context: Context): Promise<ReturnedSubNavGroup[]> => {
      const cmsNavConfig = [
        ...filterHidden(
          [
            {
              label: 'Collections',
              items: await Promise.all(
                context.config.collections
                  .filter(({ name }) => name !== 'Team' && name !== 'User')
                  .filter(({ navLabel }) => navLabel !== '__hidden')
                  .sort((a, b) => {
                    let nameA = a.navLabel || a.name;
                    if (nameA.split('::').length === 2) nameA = nameA.split('::')[1];

                    let nameB = b.navLabel || b.name;
                    if (nameB.split('::').length === 2) nameB = nameB.split('::')[1];

                    return nameA.localeCompare(nameB);
                  })
                  .map(async (collection) => {
                    const isHidden = !(await helpers.canDo({ model: collection.name, action: 'get', context }));
                    const pluralName = pluralize(collection.name);
                    const hyphenatedName = camelToDashCase(pluralName);
                    let label = collection.navLabel || capitalize(hyphenatedName.replace('-', ' '));
                    let to = `/cms/collection/${hyphenatedName}`;

                    if (collection.name === 'Photo') {
                      label = `Photo library`;
                      to = `/cms/photos/library`;
                    }

                    return { label, icon: 'CircleSmall24Filled', to, isHidden };
                  })
              ),
            },
          ],
          context
        ),
        ...filterHidden(context.config.navigation.sub[key], context),
      ];

      return cmsNavConfig.map((group) => {
        return {
          label: group.label,
          items: group.items.map((item) => {
            return {
              label: item.label,
              // use circle icon if no other icon is provided
              icon: item.icon || 'CircleSmall24Filled',
              to: item.to,
              isHidden: item.isHidden,
            };
          }),
        };
      });
    },
  },
  ConfigurationSecurity: {
    introspection: (_: unknown, __: unknown, context: Context): boolean => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      try {
        return context.config.introspection || false;
      } catch {
        return false;
      }
    },
    secrets: (_: unknown, __: unknown, context: Context): Configuration['secrets'] => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      try {
        return context.config.secrets;
      } catch {
        return {
          aws: null,
          fathom: null,
        };
      }
    },
    tokens: (_: unknown, __: unknown, context: Context): Configuration['tokens'] => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      try {
        return context.config.tokens;
      } catch {
        return [];
      }
    },
  },
};

const filterHidden = (groups: SubNavGroup[] | undefined, context: Context): SubNavGroup[] => {
  if (!groups) return [];
  return groups
    .map((group): ReturnedSubNavGroup | null => {
      // store the group items that are not hidden
      const enabledGroupItems = group.items.filter((item) => {
        if (isObject(item.isHidden)) {
          if (typeof item.isHidden.notInTeam === 'string') {
            return context.profile?.teams.includes(item.isHidden.notInTeam);
          }
          return item.isHidden.notInTeam.some((team) => context.profile?.teams.includes(team));
        }
        return item.isHidden !== true;
      });

      // if there are no visible items, do not show the group
      if (enabledGroupItems.length === 0) return null;

      // otherwise, return the group

      return {
        ...group,
        items: enabledGroupItems.map((item) => {
          delete item.isHidden;
          return item as ReturnedSubNavGroup['items'][0];
        }),
      };
    })
    .filter((group): group is ReturnedSubNavGroup => !!group);
};

export { configuration };
