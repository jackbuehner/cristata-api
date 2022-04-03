import { Context } from '../../../apollo';
import { ReturnedMainNavItem, ReturnedSubNavGroup, SubNavGroup } from '../../../types/config';
import { isObject } from '../../../utils/isObject';

const configuration = {
  Query: {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    configuration: () => {
      return {
        navigation: {},
      };
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
