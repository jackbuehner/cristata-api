/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { insertUserToArray } from '@jackbuehner/cristata-utils';
import { ApolloError } from 'apollo-server-core';
import { ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, findDoc, requireAuthentication } from '.';
import { Context } from '../server';
import { setYDocType } from './setYDocType';

interface WatchDoc {
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
   * Whether the document with the matching accessor key and value
   * should be watched by the current user.
   * @default true
   */
  watch?: boolean;
  /**
   * The unique id of the user who should be marked as
   * watching or unwatching. Defaults to the current user.
   */
  watcher?: mongoose.Types.ObjectId;
  /**
   * An Apollo context object.
   */
  context: Context;
}

async function watchDoc({ model, accessor, watch, watcher, context }: WatchDoc) {
  requireAuthentication(context);

  // set defaults
  if (watch === undefined) watch = true;
  if ((watcher === undefined || !mongoose.isValidObjectId(watcher)) && context.profile)
    watcher = context.profile._id;
  else watcher = new mongoose.Types.ObjectId(watcher);
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc) {
    throw new ApolloError(
      'the document you are trying to watch does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );
  }

  // if the user cannot watch this document, return an error
  if (!(await canDo({ action: 'watch', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot watch this document');

  // update document watchers
  if (watch) {
    doc.people.watching = insertUserToArray(doc.people.watching, watcher); // adds the user to the array, and then removes duplicates
  } else {
    doc.people.watching = doc.people.watching.filter((_id) => _id.toHexString() !== watcher?.toHexString());
  }

  // save the document
  const res = await doc.save();

  // sync the changes to the yjs doc
  setYDocType(context, model, accessor.value.toString(), async (TenantModel, ydoc, sharedHelper) => {
    const type = new sharedHelper.Reference(ydoc);
    const key = 'people.watching';
    const referenceConfig = { collection: 'User' };

    await type.set(
      key,
      res.people.watching.map((_id) => _id.toHexString()),
      TenantModel,
      referenceConfig
    );

    return true;
  });

  return res;
}

export { watchDoc };
