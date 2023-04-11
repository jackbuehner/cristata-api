/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { notEmpty } from '@jackbuehner/cristata-utils';
import getFieldNames from 'graphql-list-fields';
import mongoose from 'mongoose';
import { TenantDB } from '../../mongodb/TenantDB';
import helpers, { getUsers } from '../helpers';
import { DateScalar, JsonScalar, ObjectIdScalar, VoidScalar } from '../scalars';
import { Context } from '../server';

type ActivityArgs = { limit?: number; collections?: string[]; exclude?: string[]; page?: number };
type WorkflowArgs = { collections?: string[]; exclude?: string[] };
type ObjectId = mongoose.Types.ObjectId;
type Info = Parameters<typeof getFieldNames>[0];

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
      helpers.requireAuthentication(context);

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
    async workflow(_: never, { collections, exclude }: WorkflowArgs, context: Context) {
      helpers.requireAuthentication(context);

      let collectionNames = context.config.collections.map((col) => col.name);
      if (collections) collectionNames = collectionNames.filter((name) => collections.includes(name));
      else if (exclude) collectionNames = collectionNames.filter((name) => !exclude.includes(name));

      const collectionNamesPluralized = collectionNames
        .filter(
          (name) =>
            name !== 'File' && name !== 'Photo' && name !== 'User' && name !== 'Team' && name !== 'Activity'
        )
        .map((name) => [name, mongoose.pluralize()?.(name)])
        .filter((c): c is [string, string] => !!c);

      const tenantDB = new TenantDB(context.tenant, context.config.collections);
      await tenantDB.connect();
      const Model = await tenantDB.model(collectionNames[0]);

      const pipeline = [
        { $match: { __nonce: true } },

        ...collectionNamesPluralized.map(([collectionName, collectionNamePluralized]) => ({
          $unionWith: {
            coll: collectionNamePluralized,
            pipeline: [
              { $match: { stage: { $ne: null, $lt: 5, $exists: true } } },
              { $match: { hidden: false } },
              { $match: { archived: false } },
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
              { $project: { stage: 1, _id: 1, name: 1 } },
              { $addFields: { in: collectionName, column: { $toInt: '$stage' } } },
            ],
          },
        })),
        {
          $group: {
            _id: '$column',
            count: { $count: {} },
            docs: {
              $push: {
                $cond: {
                  if: { $lt: ['$stage', 5] },
                  then: { _id: '$_id', name: '$name', stage: '$stage', in: '$in' },
                  else: null,
                },
              },
            },
          },
        },
      ];

      const aggregate = await Model?.aggregate(pipeline as mongoose.PipelineStage[]);

      return aggregate?.map((group) => {
        return {
          ...group,
          docs: group.docs.filter(notEmpty),
        };
      });
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
    user: ({ user }: { user: ObjectId }, __: never, context: Context, info: Info) =>
      getUsers(user, context, info),
  },
  CollectionPermissions: {
    users: ({ users }: { users: ObjectId[] }, __: never, context: Context, info: Info) =>
      getUsers(users, context, info),
  },
};

export { core };
