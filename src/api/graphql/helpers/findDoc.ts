/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../server';
import mongoose, { FilterQuery } from 'mongoose';
import { canDo, CollectionDoc, requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';

interface FindDoc {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  filter?: FilterQuery<unknown>;
  context: Context;
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
  lean?: boolean;
}

async function findDoc(params: { lean: false } & FindDoc): Promise<HydratedCollectionDoc>;
async function findDoc(params: { lean?: true } & FindDoc): Promise<LeanCollectionDoc>;
async function findDoc({
  model,
  by,
  _id,
  filter,
  context,
  fullAccess,
  accessRule,
  lean,
}: FindDoc): Promise<LeanCollectionDoc | HydratedCollectionDoc> {
  if (!fullAccess) requireAuthentication(context);
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();
  const Model = await tenantDB.model<CollectionDoc>(model);

  // whether the collection docs contain the standard teams and user permissions object
  const withStandardPermissions = context.config.collections.find((col) => col.name === model).withPermissions;

  // whether the current user can bypass the access filter
  const canBypassAccessFilter =
    fullAccess ||
    context.profile.teams.includes('000000000000000000000001') ||
    !withStandardPermissions ||
    (await canDo({ action: 'bypassDocPermissions', model, context }));

  // access filter
  const accessFilter = canBypassAccessFilter
    ? {}
    : accessRule
    ? accessRule
    : {
        $or: [
          { 'permissions.teams': { $in: [...context.profile.teams, 0, '0'] } },
          { 'permissions.users': context.profile._id },
          { 'permissions.users': new mongoose.Types.ObjectId('000000000000000000000000') },
        ],
      };

  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter ? filter : {} },
    { $match: accessFilter },
    { $match: { [by || '_id']: _id || null } },
    { $sort: { 'timestamps.created_at': -1 } },
  ];

  // get the document as a plain javascript object
  const doc = (await Model.aggregate(pipeline))[0];

  // return the document
  if (lean !== false || doc === undefined) return doc; // also return lean doc if the doc is undefined
  return Model.findById(doc._id); // as an instance of the mongoose Document class if lean === false
}

type LeanCollectionDoc = CollectionDoc;
type HydratedCollectionDoc = mongoose.Document<unknown, unknown, CollectionDoc> & CollectionDoc;

export { findDoc };
