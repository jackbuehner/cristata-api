import {
  deconstructSchema,
  defaultSchemaDefTypes,
  SchemaDefType,
} from '@jackbuehner/cristata-generator-schema';
import { camelToDashCase, capitalize, hasKey, isObject } from '@jackbuehner/cristata-utils';
import { ForbiddenError, UserInputError } from 'apollo-server-errors';
import { merge } from 'merge-anything';
import { ObjectId } from 'mongoose';
import pluralize from 'pluralize';
import { v3 } from 'uuid';
import { TenantDB } from '../../mongodb/TenantDB';
import {
  Collection,
  Configuration,
  ReturnedMainNavItem,
  ReturnedSubNavGroup,
  SubNavGroup,
} from '../../types/config';
import { collectionsAsCollectionInputs, constructCollections } from '../../utils/constructCollections';
import helpers, { requireAuthentication } from '../helpers';
import { GenCollectionInput } from '../helpers/generators/genCollection';
import { Context } from '../server';

const configuration = {
  Query: {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    configuration: (_: unknown, __: unknown, context: Context) => {
      return {
        dashboard: {},
        navigation: {},
        security: {},
        apps: {},
        collection: async ({ name }: { name: string }) => {
          helpers.requireAuthentication(context);

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
              pluralName:
                collection.navLabel?.split('::').slice(-1)[0] ||
                camelToDashCase(pluralize(name)).replace(/-/g, ' '),
              canCreateAndGet:
                (await helpers.canDo({ model: name, action: 'create', context })) &&
                (await helpers.canDo({ model: name, action: 'get', context })),
            };
          }

          // if the collection does not exist, return null
          return null;
        },
        collections: () => {
          helpers.requireAuthentication(context);

          return Promise.all(
            context.config.collections
              .filter((col) => col.name !== 'User' && col.name !== 'Team')
              .map(async (col) => {
                return {
                  ...col,
                  pluralName:
                    col.navLabel?.split('::').slice(-1)[0] ||
                    camelToDashCase(pluralize(col.name)).replace(/-/g, ' '),
                  canCreateAndGet:
                    (await helpers.canDo({ model: col.name, action: 'create', context })) &&
                    (await helpers.canDo({ model: col.name, action: 'get', context })),
                };
              })
          );
        },
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

      if (name === 'User') throw new UserInputError('cannot configure User collection');
      if (name === 'Team') throw new UserInputError('cannot configure Team collection');
      if (name === 'File') throw new UserInputError('cannot configure File collection');
      if (name === 'Activity') throw new UserInputError('cannot configure Activity collection');
      return setRawConfigurationCollection({ name, raw }, context);
    },
    deleteCollection: async (_: unknown, { name }: { name: string }, context: Context): Promise<void> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      if (name === 'User') throw new UserInputError('cannot delete User collection');
      if (name === 'Team') throw new UserInputError('cannot delete Team collection');
      if (name === 'File') throw new UserInputError('cannot delete File collection');
      if (name === 'Activity') throw new UserInputError('cannot delete Activity collection');

      const appDb = new TenantDB('app');
      const appConn = await appDb.connect();

      const tenantsCollection = appConn.db.collection<{
        _id: ObjectId;
        name: string;
        config: Configuration;
      }>('tenants');

      // construct the new config
      const backup: Configuration<Collection> = JSON.parse(JSON.stringify(context.config));
      const copy: Configuration<Collection> = JSON.parse(JSON.stringify(backup));
      const removed = copy.collections.filter((col) => col.name !== name);

      // check if the new config is valid
      const newConfig = {
        ...copy,
        collections: constructCollections(removed.map(collectionsAsCollectionInputs), context.tenant),
      };
      const ret = await context.testNewConfig(newConfig);
      if (ret instanceof Error) {
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
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantsCollection = context.cristata.tenantsCollection;

      // update the config in the database
      await tenantsCollection?.findOneAndUpdate(
        { name: context.tenant },
        { $set: { [`config.secrets.${key}`]: value } },
        { returnDocument: 'after' }
      );

      // return the value that is now available in the cristata instance
      return value;
    },
    setConfigurationNavigationSub: async (
      _: unknown,
      { key, input }: { key: string; input: SubNavGroup[] },
      context: Context
    ): Promise<ReturnedSubNavGroup[]> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      // remove the default collections group
      input = input.filter((v) => v.label !== 'Collections');

      const tenantsCollection = context.cristata.tenantsCollection;

      // update the config in the database
      const res = await tenantsCollection?.findOneAndUpdate(
        { name: context.tenant },
        { $set: { [`config.navigation.sub.${key}`]: input } },
        { returnDocument: 'after' }
      );

      if (res?.value?.config) {
        const newConfig = {
          ...res.value.config,
          collections: constructCollections(res.value.config.collections, context.tenant),
        };
        return returnCmsNavConfig(
          {
            ...context,
            config: newConfig,
          },
          key
        );
      }

      return returnCmsNavConfig(context, key);
    },
    setProfilesAppFieldDescriptions: async (
      _: unknown,
      { input }: { input: Record<string, string> },
      context: Context
    ): Promise<void> => {
      helpers.requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantsCollection = context.cristata.tenantsCollection;

      // update the config in the database
      await tenantsCollection?.findOneAndUpdate(
        { name: context.tenant },
        { $set: { [`config.apps.profiles.fieldDescriptions`]: input } },
        { returnDocument: 'after' }
      );
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
    main: async (_: unknown, __: unknown, context: Context): Promise<ReturnedMainNavItem[]> => {
      helpers.requireAuthentication(context);

      return Promise.all(
        context.config.navigation.main
          .filter((item) => {
            if (isObject(item.isHidden)) {
              if (typeof item.isHidden.notInTeam === 'string') {
                return context.profile?.teams.includes(item.isHidden.notInTeam);
              }
              return item.isHidden.notInTeam.some((team) => context.profile?.teams.includes(team));
            }
            return item.isHidden !== true;
          })
          .map(async (item): Promise<ReturnedMainNavItem> => {
            delete item.isHidden;
            if (isObject(item.to)) {
              const subNavConfig = await getCmsNavConfig(context, item.to.first);
              return {
                ...item,
                to: subNavConfig[0]?.items?.[0]?.to || '/',
              };
            }
            return { ...item, to: item.to };
          })
      );
    },
    sub: async (_: unknown, { key }: { key: string }, context: Context): Promise<ReturnedSubNavGroup[]> => {
      helpers.requireAuthentication(context);

      return returnCmsNavConfig(context, key);
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
  ConfigurationApps: {
    // goes to the ConfigurationProfilesApp resolver
    profiles: () => ({}),
  },
  ConfigurationProfilesApp: {
    fieldDescriptions: (
      _: unknown,
      __: unknown,
      context: Context
    ): Required<NonNullable<NonNullable<Context['config']['apps']>['profiles']>['fieldDescriptions']> => {
      const fieldDescriptions = context.config.apps?.profiles?.fieldDescriptions || {};

      return {
        name: fieldDescriptions.name ?? getDefaultProfileFieldDescription('name'),
        email: fieldDescriptions.email ?? getDefaultProfileFieldDescription('email'),
        phone: fieldDescriptions.phone ?? getDefaultProfileFieldDescription('phone'),
        twitter: fieldDescriptions.twitter ?? getDefaultProfileFieldDescription('twitter'),
        biography: fieldDescriptions.biography ?? getDefaultProfileFieldDescription('biography'),
        title: fieldDescriptions.title ?? getDefaultProfileFieldDescription('title'),
      };
    },
    defaultFieldDescriptions: (): Required<
      NonNullable<NonNullable<Context['config']['apps']>['profiles']>['fieldDescriptions']
    > => {
      return {
        name: getDefaultProfileFieldDescription('name'),
        email: getDefaultProfileFieldDescription('email'),
        phone: getDefaultProfileFieldDescription('phone'),
        twitter: getDefaultProfileFieldDescription('twitter'),
        biography: getDefaultProfileFieldDescription('biography'),
        title: getDefaultProfileFieldDescription('title'),
      };
    },
  },
};

function getDefaultProfileFieldDescription(
  field: keyof NonNullable<NonNullable<NonNullable<Context['config']['apps']>['profiles']>['fieldDescriptions']>
): string {
  if (field === 'name') return 'The name of this user. This does not change the username or slug.';
  if (field === 'email') return "The user's email. Try to only use your organization's email domain.";
  if (field === 'phone')
    return 'Add your number so coworkers can contact you about your work. It is only available to users with Cristata accounts.';
  if (field === 'twitter') return 'Let everyone know where to follow you.';
  if (field === 'biography')
    return 'A short biography highlighting accomplishments and qualifications. It should be in paragraph form and written in the third person.';
  if (field === 'title') return 'The position or job title for the user.';
  return '';
}

function filterHidden(
  groups: SubNavGroup[] | undefined,
  context: Context,
  opts: { keepHiddenFilter: true }
): SubNavGroup[];
function filterHidden(
  groups: SubNavGroup[] | undefined,
  context: Context,
  opts: { keepHiddenFilter?: boolean }
): ReturnedSubNavGroup[] | SubNavGroup[] {
  if (!groups) return [];
  return groups
    .map((group): ReturnedSubNavGroup | null => {
      // store the group items that are not hidden
      const enabledGroupItems = group.items.filter((item) => {
        if (item.hiddenFilter) {
          if (typeof item.hiddenFilter.notInTeam === 'string') {
            return context.profile?.teams.includes(item.hiddenFilter.notInTeam);
          }
          return item.hiddenFilter.notInTeam.some((team) => context.profile?.teams.includes(team));
        }
        return item.isHidden !== true;
      });

      // if there are no visible items, do not show the group
      if (enabledGroupItems.length === 0) return null;

      // otherwise, return the group
      return {
        ...group,
        items: enabledGroupItems.map((item) => {
          if (!opts.keepHiddenFilter) delete item.isHidden;
          return item as ReturnedSubNavGroup['items'][0];
        }),
      };
    })
    .filter((group): group is ReturnedSubNavGroup => !!group);
}

const setRawConfigurationCollection = async (
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

  // create a backup of the existing config
  const backup: Configuration<Collection> = JSON.parse(JSON.stringify(context.config));

  // construct the new config
  const collectionFromRaw = helpers.generators.genCollection(raw, context.tenant);
  const copy: Configuration<Collection> = JSON.parse(JSON.stringify(backup));
  const colIndex = copy.collections.findIndex((col) => col.name === name);
  if (colIndex === -1) copy.collections.push(collectionFromRaw);
  else copy.collections[colIndex] = collectionFromRaw;

  // check if the new config is valid
  const newConfig = {
    ...copy,
    collections: constructCollections(copy.collections.map(collectionsAsCollectionInputs), context.tenant),
  };
  const ret = await context.testNewConfig(newConfig);
  if (ret instanceof Error) {
    // throw the error
    throw ret;
  }

  // clear the models so that models based on an old version of the config
  // are not used with the new collection configs
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  for (const modelName in tenantDB.models.keys()) {
    tenantDB.models.delete(modelName);
  }

  // determine if the collection is in the database config
  const res = await tenantsCollection.findOne(
    { name: context.tenant },
    { projection: { 'config.collections.name': 1 } }
  );
  const dbCollections = res?.config.collections.map((collection) => collection.name) || [];
  const isInDbConfig = dbCollections.includes(raw.name);

  if (!isInDbConfig) {
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

  if (!isInDbConfig) return raw;
  const initialColConfig = backup.collections.find((col) => col.name === name)?.raw;
  if (!initialColConfig) return raw;

  // add or remove required keys when toggling independentPublishedDocCopy option
  if (initialColConfig.options?.independentPublishedDocCopy !== raw.options?.independentPublishedDocCopy) {
    const shouldCreatePublishedCopy =
      !initialColConfig.options?.independentPublishedDocCopy && !!raw.options?.independentPublishedDocCopy;
    const shouldDeletePublishedCopy =
      !!initialColConfig.options?.independentPublishedDocCopy && !raw.options?.independentPublishedDocCopy;

    // upate every published doc to include a published doc copy
    if (shouldCreatePublishedCopy) {
      const Model = await tenantDB.model(name);

      if (Model) {
        const schema = merge<SchemaDefType, SchemaDefType[]>(
          raw.schemaDef || {},
          defaultSchemaDefTypes.standard,
          raw.canPublish ? defaultSchemaDefTypes.publishable : {},
          raw.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
        );

        const docNonPrivateKeys = deconstructSchema(schema)
          .map(([key]) => key)
          .filter((key) => key.indexOf('_') !== 0);

        await Model.updateMany({ stage: 5.2 }, [
          {
            $set: {
              ...docNonPrivateKeys.reduce(
                (obj, key) => {
                  return Object.assign(obj, { [`__publishedDoc.${key}`]: `$${key}` });
                },
                { '__publishedDoc._id': '$_id' }
              ),
              _hasPublishedDoc: true,
            },
          },
        ]);
      }
    }
    // remove the published doc copy
    else if (shouldDeletePublishedCopy) {
      const Model = await tenantDB.model(name);

      if (Model) {
        await Model.updateMany({ __publishedDoc: { $exists: true } }, [{ $set: { stage: 5.2 } }]);
        await Model.updateMany({}, [{ $unset: ['__publishedDoc', '_hasPublishedDoc'] }]);
      }
    }
  }

  // return the value that is now available in the cristata instance
  return raw;
};

const getCmsNavConfig = async (context: Context, key = 'cms') => {
  const values: SubNavGroup[] = [
    ...context.config.navigation.sub[key].map((group) => {
      return {
        ...group,
        items: group.items.map((item) => {
          return {
            ...item,
            isHidden: typeof item.isHidden === 'boolean' ? item.isHidden : undefined,
            hiddenFilter: isObject(item.isHidden)
              ? typeof item.isHidden.notInTeam === 'string'
                ? { notInTeam: [item.isHidden.notInTeam] }
                : { notInTeam: item.isHidden.notInTeam }
              : undefined,
          };
        }),
      };
    }),
    ...(key === 'cms'
      ? [
          {
            uuid: v3('Collections', 'c2af0a4c-5c85-4959-9e48-7dbd4f5fc8f7'),
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
                  const to = `/cms/collection/${hyphenatedName}`;

                  if (collection.name === 'Photo') {
                    label = `Photo library`;
                  }

                  return {
                    uuid: v3(label, 'c2af0a4c-5c85-4959-9e48-7dbd4f5fc8f7'),
                    label,
                    icon: 'CircleSmall24Filled' as (typeof context.config.navigation.sub)['cms'][0]['items'][0]['icon'],
                    to,
                    isHidden,
                  };
                })
            ),
          },
        ]
      : []),
  ];

  // inject uuids if they are missing
  values.forEach((group) => {
    if (!group.uuid) group.uuid = v3(group.label, '33f084b9-02c1-4077-898a-819dd6fa615e');

    group.items.forEach((item) => {
      if (!item.uuid) item.uuid = v3(item.label, '33f084b9-02c1-4077-898a-819dd6fa615e');
    });
  });

  return filterHidden(values, context, { keepHiddenFilter: true });
};

const returnCmsNavConfig = async (context: Context, key = 'cms') => {
  const cmsNavConfig = await getCmsNavConfig(context, key);

  return cmsNavConfig.map((group) => {
    return {
      uuid: group.uuid,
      label: group.label,
      items: group.items.map((item) => {
        return {
          uuid: item.uuid,
          label: item.label,
          // use circle icon if no other icon is provided
          icon: item.icon || 'CircleSmall24Filled',
          to: item.to,
          isHidden: item.isHidden,
          hiddenFilter: item.hiddenFilter,
        };
      }),
    };
  });
};

export { configuration, setRawConfigurationCollection };
