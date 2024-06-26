/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloError } from 'apollo-server-core';
import mongoose, { FilterQuery, PipelineStage } from 'mongoose';
import { CollectionDoc, canDo, requireAuthentication } from '.';
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
    pipeline2?: mongoose.PipelineStage[]; // could be provided by clients
  };
  context: Context;
  fullAccess?: boolean;
  project?: PipelineStage.Project['$project'];
}

async function findDocs({ model, args, context, fullAccess, project }: FindDocs) {
  if (!fullAccess) requireAuthentication(context);

  const canFindDocs = fullAccess || (await canDo({ action: 'get', model, context }));
  if (!canFindDocs) return [];

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

  // use provided projection, but fall back to exlcuding y fields (which can be quite large)
  const $project = project ? project : { __yState: 0, __yVersions: 0, yState: 0, __migrationBackup: 0 };

  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter ? filter : {} },
    { $match: accessFilter },
    { $match: _ids ? { _id: { $in: _ids } } : {} },
    { $sort: { _id: -1 } },
    { $project },
    ...(args.pipeline2 || []),
  ];

  const canAllowDiskUse = context.cristata.canTenantAllowDiskUse[context.tenant] || false;
  const aggregate = Model.aggregate(pipeline).allowDiskUse(canAllowDiskUse);

  // offset and page or incompatable, so do not pass page variable when offset is defined
  if (offset !== undefined) {
    // @ts-expect-error aggregatePaginate DOES exist.
    // The types for the plugin have not been updated for newer versions of mongoose.
    return await Model.aggregatePaginate(aggregate, { sort, offset, limit });
  }
  // @ts-expect-error aggregatePaginate DOES exist.
  // The types for the plugin have not been updated for newer versions of mongoose.
  return await Model.aggregatePaginate(aggregate, { sort, page, limit, allowDiskUse: true });
}

export { findDocs };
