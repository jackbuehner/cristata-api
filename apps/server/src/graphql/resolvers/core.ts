/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { notEmpty } from '@jackbuehner/cristata-utils';
import mongoose from 'mongoose';
import { TenantDB } from '../../mongodb/TenantDB';
import { getUsers } from '../helpers';
import { DateScalar, JsonScalar, ObjectIdScalar, VoidScalar } from '../scalars';
import { Context } from '../server';

type ActivityArgs = { limit?: number; collections?: string[]; exclude?: string[]; page?: number };

const core = {
  Date: DateScalar,
  ObjectID: ObjectIdScalar,
  JSON: JsonScalar,
  Void: VoidScalar,
  Query: {
    collectionActivity: async (
      _: never,
      { limit, collections, exclude, page }: ActivityArgs,
      context: Context
    ) => {
      let collectionNames = context.config.collections.map((col) => col.name);
      if (collections) collectionNames = collectionNames.filter((name) => collections.includes(name));
      else if (exclude) collectionNames = collectionNames.filter((name) => !exclude.includes(name));

      const collectionNamesPluralized = collectionNames
        .map((name) => mongoose.pluralize()?.(name))
        .filter(notEmpty);

      const tenantDB = new TenantDB(context.tenant, context.config.collections);
      await tenantDB.connect();
      const Model = await tenantDB.model(collectionNames[0]);

      const pipeline: mongoose.PipelineStage[] = [
        { $addFields: { in: collectionNamesPluralized[0] } },
        ...collectionNamesPluralized.map((collectionName) => ({
          $unionWith: {
            coll: collectionName,
            pipeline: [{ $addFields: { in: collectionName } }],
          },
        })),
        { $unwind: { path: '$history' } },
        {
          $project: {
            // _id: projected by default
            in: 1,
            name: 1,
            'permissions.teams': 1,
            'permissions.users': 1,
            user: '$history.user',
            action: '$history.type',
            at: '$history.at',
          },
        },
        { $sort: { at: -1 } },
        {
          $match: context.profile?.teams.includes('000000000000000000000001')
            ? {}
            : {
                $or: [
                  { 'permissions.teams': { $in: context.profile?.teams || [] } },
                  { 'permissions.users': context.profile?._id || '000000000000000000000001' },
                ],
              },
        },
        { $limit: limit || 10 },
      ];

      const aggregate = Model?.aggregate(pipeline);

      // @ts-expect-error aggregatePaginate DOES exist.
      // The types for the plugin have not been updated for newer versions of mongoose.
      return Model.aggregatePaginate(aggregate, { page, limit });
    },
    async tenant(_: never, __: never, context: Context) {
      const tenant = await context.cristata.tenantsCollection?.findOne({ name: context.tenant });

      if (tenant) {
        return {
          name: tenant.name,
          displayName: tenant.config.tenantDisplayName,
        };
      }

      return null;
    },
  },
  CollectionActivity: {
    user: ({ user }: { user: mongoose.Types.ObjectId }, __: never, context: Context) => getUsers(user, context),
  },
  CollectionPermissions: {
    users: ({ users }: { users: mongoose.Types.ObjectId[] }, __: never, context: Context) =>
      getUsers(users, context),
  },
};

export { core };
