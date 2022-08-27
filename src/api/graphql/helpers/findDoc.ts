/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApolloError } from 'apollo-server-core';
import mongoose, { FilterQuery } from 'mongoose';
import * as Y from 'yjs';
import { canDo, CollectionDoc, requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';
import { deconstructSchema } from '../../utils/deconstructSchema';
import { addToY } from '../../yjs/addToY';
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
}: FindDoc): Promise<LeanCollectionDoc | HydratedCollectionDoc | null | undefined> {
  if (!fullAccess) requireAuthentication(context);

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

  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter ? filter : {} },
    { $match: accessFilter },
    { $match: { [by || '_id']: _id || null } },
    { $sort: { 'timestamps.created_at': -1 } },
  ];

  // get the document as a plain javascript object
  const doc = (await Model.aggregate(pipeline))[0];

  // create yjs doc if it does not exist
  try {
    const uint8ToBase64 = (arr: Uint8Array): string => Buffer.from(arr).toString('base64');

    if (!doc?.yState) {
      const ydoc = new Y.Doc(); // create empty doc
      const collection = context.config.collections.find((col) => col.name === model);
      if (collection?.schemaDef) {
        // add doc data to ydoc shared types
        addToY({ ydoc, schemaDef: deconstructSchema(collection.schemaDef), inputData: doc });

        // make ydoc available to client
        const encodedBase64State = uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
        doc.yState = encodedBase64State;

        // also save the ydoc to the database so it can be used next time
        // instead of needing to be re-created
        const saveableDoc = await Model.findById(doc._id);
        if (saveableDoc) {
          saveableDoc.yState = encodedBase64State;
          saveableDoc.save();
        }
      }
    }
  } catch (error) {
    console.error(error);
  }

  // return the document
  if (lean !== false || doc === undefined) return doc; // also return lean doc if the doc is undefined
  return Model.findById(doc._id); // as an instance of the mongoose Document class if lean === false
}

type LeanCollectionDoc = CollectionDoc;
type HydratedCollectionDoc = mongoose.Document<unknown, unknown, CollectionDoc> & CollectionDoc;

export { findDoc };
