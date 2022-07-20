import { ForbiddenError } from 'apollo-server-errors';
import mongoose, { ObjectId } from 'mongoose';
import pluralize from 'pluralize';
import { Context } from '../../../apollo';
import { constructCollections } from '../../../Cristata';
import {
  Collection,
  Configuration,
  ReturnedMainNavItem,
  ReturnedSubNavGroup,
  SubNavGroup,
} from '../../../types/config';
import { camelToDashCase } from '../../../utils/camelToDashCase';
import { capitalize } from '../../../utils/capitalize';
import { hasKey } from '../../../utils/hasKey';
import { isObject } from '../../../utils/isObject';
import helpers, { requireAuthentication } from '../helpers';

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
      { name, raw }: { name: string; raw: Collection },
      context: Context
    ): Promise<Collection> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantsCollection = mongoose.connection.db.collection<{
        _id: ObjectId;
        name: string;
        config: Configuration;
      }>('tenants');

      // construct the new config
      const backup: Configuration<Collection> = JSON.parse(JSON.stringify(context.config));
      const copy: Configuration<Collection> = JSON.parse(JSON.stringify(backup));
      const colIndex = copy.collections.findIndex((col) => col.name === name);
      if (colIndex === -1) copy.collections[copy.collections.length] = raw;
      else copy.collections[colIndex] = raw;

      // update the config in the cristata instance
      context.cristata.config[context.tenant] = constructCollections(copy, context.tenant);
      const ret = await context.restartApollo();

      // something went wrong
      if (ret instanceof Error) {
        // restore the old config
        context.cristata.config[context.tenant] = constructCollections(backup, context.tenant);

        // throw the error
        throw ret;
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
    setSecret: async (_: unknown, { key, value }: { key: string; value: Collection }, context: Context) => {
      requireAuthentication(context);
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantsCollection = context.cristata.tenantsCollection;

      // update the config in the database
      const res = await tenantsCollection.findOneAndUpdate(
        { name: context.tenant },
        { $set: { [`config.secrets.${key}`]: value } },
        { returnDocument: 'after' }
      );

      // update the config in the cristata instance
      context.cristata.config[context.tenant] = constructCollections(res.value.config, context.tenant);
      await context.restartApollo();

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
              return context.profile.teams.includes(item.isHidden.notInTeam);
            }
            return item.isHidden.notInTeam.some((team) => context.profile.teams.includes(team));
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
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      try {
        return context.config.introspection || false;
      } catch {
        return false;
      }
    },
    secrets: (_: unknown, __: unknown, context: Context): Configuration['secrets'] => {
      requireAuthentication(context);
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
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
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
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
            return context.profile.teams.includes(item.isHidden.notInTeam);
          }
          return item.isHidden.notInTeam.some((team) => context.profile.teams.includes(team));
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
