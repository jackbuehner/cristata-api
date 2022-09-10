/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { flattenObject } from '@cristata/utils';
import { ApolloError } from 'apollo-server-core';
import mongoose, { FilterQuery } from 'mongoose';
import { canDo, CollectionDoc, requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

interface FindDocs {
  model: string;
  args: {
    _ids?: mongoose.Types.ObjectId[];
    filter?: FilterQuery<unknown>;
    sort?: string | Record<string, unknown>;
    page?: number;
    offset?: number;
    limit: number;
    pipeline2?: mongoose.PipelineStage[];
  };
  context: Context;
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
}

async function findDocs({ model, args, context, fullAccess, accessRule }: FindDocs) {
  if (!fullAccess) requireAuthentication(context);

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const Model = await tenantDB.model<CollectionDoc>(model);
  if (!Model) throw new ApolloError('model not found');

  const { _ids, filter, offset } = args;
  let { limit, sort, page } = args;

  if (limit > 100) limit = 100; // never send more than 100 docs per page
  if (!sort) sort = { 'timestamps.created_at': 1 };

  if (!offset && !page) page = 1; // default to page 1

  // whether the collection docs contain the standard teams and user permissions object
  const withStandardPermissions = context.config.collections.find((col) => col.name === model)?.withPermissions;

  // whether the current user can bypass the access filter
  const canBypassAccessFilter =
    fullAccess ||
    context.profile?.teams.includes('000000000000000000000001') ||
    !withStandardPermissions ||
    (await canDo({ action: 'bypassDocPermissions', model, context }));

  // access filter
  const accessFilter = canBypassAccessFilter
    ? {}
    : accessRule
    ? accessRule
    : {
        $or: [
          ...(context.profile
            ? [
                { 'permissions.teams': { $in: [...context.profile.teams, 0, '0'] } },
                { 'permissions.users': context.profile._id },
              ]
            : []),
          { 'permissions.users': new mongoose.Types.ObjectId('000000000000000000000000') },
        ],
      };

  // add temporary fields for timestamps that speciify whether they are greater
  // than the baseline date meant for use in `accessFilter`
  // (field names are key + _is_baseline)
  const timestampBaselineBooleanFields = [
    ...new Set(
      Object.keys(flattenObject(Model.schema.obj as { [x: string]: never }))
        .filter((key) => key.includes('timestamps.obj'))
        .filter((key) => !key.includes('id'))
        .map((key) =>
          key.replace('.type', '').replace('.default', '').replace('.obj', '').replace('.required', '')
        )
    ),
  ].map((key) => ({
    $addFields: {
      [key + '_is_baseline']: {
        $or: [
          { $eq: ['$' + key, new Date('0001-01-01T01:00:00.000+00:00')] },
          { $cond: [{ $lte: ['$' + key, null] }, true, false] },
        ],
      },
    },
  }));

  const pipeline: mongoose.PipelineStage[] = [
    ...timestampBaselineBooleanFields,
    { $match: filter ? filter : {} },
    { $match: accessFilter },
    { $match: _ids ? { _id: { $in: _ids } } : {} },
    { $sort: { 'timestamps.created_at': -1 } },
    ...(args.pipeline2 || []),
  ];

  const aggregate = Model.aggregate(pipeline);

  // offset and page or incompatable, so do not pass page variable when offset is defined
  if (offset !== undefined) {
    // @ts-expect-error aggregatePaginate DOES exist.
    // The types for the plugin have not been updated for newer versions of mongoose.
    return await Model.aggregatePaginate(aggregate, { sort, offset, limit });
  }
  // @ts-expect-error aggregatePaginate DOES exist.
  // The types for the plugin have not been updated for newer versions of mongoose.
  return await Model.aggregatePaginate(aggregate, { sort, page, limit });
}

export { findDocs };
