/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../server';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';
import { insertUserToArray } from '../../utils/insertUserToArray';
import { ApolloError } from 'apollo-server-core';
import { isDefinedDate } from '../../utils/isDefinedDate';

interface LockDoc {
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
   * should be locked.
   * @default true
   */
  lock?: boolean;
  /**
   * An Apollo context object.
   */
  context: Context;
}

async function lockDoc({ model, accessor, lock, context }: LockDoc) {
  requireAuthentication(context);

  // set defaults
  if (lock === undefined) lock = true;
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc) {
    throw new ApolloError(
      'the document you are trying to lock does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );
  }

  // if the document is currently published, do not modify unless user can publish
  const canPublish = context.config.collections.find(({ name }) => name === model)?.canPublish;
  if (canPublish) {
    const isPublished = isDefinedDate(doc.timestamps.published_at);

    if (isPublished && !(await canDo({ action: 'publish', model, context })))
      throw new ForbiddenError('you cannot lock this document when it is published');
  }

  // if the user cannot lock this document, return an error
  if (!(await canDo({ action: 'lock', model, context })))
    throw new ForbiddenError('you cannot lock this document');

  // set the locked property in the document
  doc.locked = lock;

  // set relevant collection metadata
  if (context.profile) {
    doc.people.modified_by = insertUserToArray(doc.people.modified_by, context.profile._id);
    doc.people.last_modified_by = context.profile._id;
    doc.history = [
      ...(doc.history || []),
      {
        type: 'locked',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save the document
  return await doc.save();
}

export { lockDoc };
