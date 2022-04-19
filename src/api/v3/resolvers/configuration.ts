import { Context } from '../../../apollo';
import { Configuration, ReturnedMainNavItem, ReturnedSubNavGroup, SubNavGroup } from '../../../types/config';
import { hasKey } from '../../../utils/hasKey';
import { isObject } from '../../../utils/isObject';

const configuration = {
  Query: {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    configuration: (_: unknown, __: unknown, context: Context) => {
      return {
        dashboard: {},
        navigation: {},
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
            };
          }

          // if the collection does not exist, return null
          return null;
        },
      };
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
    sub: (_: unknown, { key }: { key: string }, context: Context): ReturnedSubNavGroup[] => {
      return filterHidden(context.config.navigation.sub[key], context);
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
