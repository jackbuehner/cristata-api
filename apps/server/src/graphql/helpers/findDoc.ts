/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloError } from 'apollo-server-core';
import mongoose, { FilterQuery, PipelineStage } from 'mongoose';
import { CollectionDoc, canDo, requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

interface FindDoc {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  filter?: FilterQuery<unknown>;
  context: Context;
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
  lean?: boolean;
  project?: PipelineStage.Project['$project'];
}

async function findDoc(params: { lean: false } & FindDoc): Promise<HydratedCollectionDoc | null | undefined>;
async function findDoc(params: { lean?: true } & FindDoc): Promise<LeanCollectionDoc | null | undefined>;
async function findDoc({
  model,
  by,
  _id,
  filter,
  context,
  fullAccess,
  accessRule,
  lean,
  project,
}: FindDoc): Promise<LeanCollectionDoc | HydratedCollectionDoc | null | undefined> {
  if (!fullAccess) requireAuthentication(context);

  const canFindDocs = fullAccess || (await canDo({ action: 'get', model, context }));
  if (!canFindDocs) return null;

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const Model = await tenantDB.model<CollectionDoc>(model);
  if (!Model) throw new ApolloError('model not found');

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

  // use provided projection, but fall back to exlcuding y fields (which can be quite large)
  const $project = project ? project : { __yState: 0, __yVersions: 0, yState: 0, __migrationBackup: 0 };

  const pipelineStages: (mongoose.PipelineStage | null)[] = [
    { $match: filter ? filter : {} },
    { $match: accessFilter },
    { $match: { [by || '_id']: _id || null } },
    { $sort: { _id: -1 } },
    { $project },
  ];

  const pipeline = pipelineStages.filter((stage): stage is mongoose.PipelineStage => !!stage);

  // get the document as a plain javascript object
  const canAllowDiskUse = context.cristata.canTenantAllowDiskUse[context.tenant] || false;
  const doc = (await Model.aggregate(pipeline).allowDiskUse(canAllowDiskUse))[0];

  // always cast team to string
  if (doc?.permissions?.teams) {
    doc.permissions.teams = doc.permissions.teams.map((team: unknown) => `${team}`);
  }

  // return the document
  if (lean !== false || doc === undefined) return doc; // also return lean doc if the doc is undefined
  return Model.findById(doc._id, $project); // as an instance of the mongoose Document class if lean === false
}

type LeanCollectionDoc = CollectionDoc;
type HydratedCollectionDoc = mongoose.HydratedDocument<CollectionDoc> & CollectionDoc;

export { findDoc };
