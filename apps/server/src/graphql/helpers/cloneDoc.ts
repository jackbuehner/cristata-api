/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { insertUserToArray } from '@jackbuehner/cristata-utils';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { CollectionDoc, canDo, createDoc, findDoc, requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

interface CloneDoc {
  /**
   * The model name for the collection of the doc to be modified.
   */
  model: string;
  accessor: {
    /**
     * The key of the accessor.
     * @default '_id'
     */
    key?: string;
    /**
     * The value of the accessor to be targeted in the database
     * (usually a unique `ObjectId`).
     */
    value: mongoose.Types.ObjectId | string | number | Date;
  };
  /**
   * An Apollo context object.
   */
  context: Context;
}

/**
 * This helper clones a specified document by creating a new document with
 * the same values as the document of the given _id.
 *
 * The `slug` field, `_id` field, and any fields starting with `__` are removed
 * during the cloning process.
 *
 * Modification metadata and history are updated during the cloning process.
 *
 * Permission to create and modify documents is required to clone a document.
 */
async function cloneDoc({
  model,
  accessor,
  context,
}: CloneDoc): Promise<mongoose.HydratedDocument<CollectionDoc> | null> {
  requireAuthentication(context);

  // set defaults
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc)
    throw new ApolloError(
      'the document you are trying to archive does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the user cannot create documents in the collection, return an error
  if (!(await canDo({ action: 'create', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot clone this document because you are not allowed to create documents');

  // if the user cannot modify documents in the collection, return an error
  if (!(await canDo({ action: 'modify', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot clone this document because you are not allowed to modify documents');

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const Model = await tenantDB.model<CollectionDoc>(model);

  if (Model) {
    const newDoc = new Model({
      ...doc.toObject(),
      // remove fields that should not be cloned
      slug: undefined,
      _id: undefined,
    });

    // set modification data
    if (context.profile) {
      newDoc.people.modified_by = insertUserToArray(newDoc.people.modified_by, context.profile._id);
      newDoc.people.last_modified_by = context.profile._id;
      newDoc.timestamps.modified_at = new Date().toISOString();
    }

    // update history
    if (context.profile && model !== 'ExternalAccount') {
      const type = 'patched';

      // TODO: remove this in a future version
      newDoc.history = [
        ...(doc.history || []),
        { type, user: context.profile._id, at: new Date().toISOString() },
      ];

      createDoc({
        model: 'Activity',
        context,
        args: {
          name: doc.name,
          type,
          colName: model,
          docId: doc._id,
          userIds: [context.profile._id],
          at: new Date(),
        },
      });
    }

    // remove yjs fields that should not be cloned
    Object.keys(newDoc).forEach((key) => {
      if (key.indexOf('__') === 0) {
        delete newDoc[key];
      }
    });

    // save the document
    return await newDoc.save();
  }

  return null;
}

export { cloneDoc };
