/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../server';
import mongoose from 'mongoose';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';
import { insertUserToArray } from '../../utils/insertUserToArray';
import { isDefinedDate } from '../../utils/isDefinedDate';
interface HideDoc {
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
   * should be hidden.
   * @default true
   */
  hide?: boolean;
  /**
   * An Apollo context object.
   */
  context: Context;
}

async function hideDoc({ model, accessor, hide, context }: HideDoc) {
  requireAuthentication(context);

  // set defaults
  if (hide === undefined) hide = true;
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc)
    throw new ApolloError(
      'the document you are trying to hide does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the document is currently published, do not modify unless user can publish
  const canPublish = context.config.collections.find(({ name }) => name === model)?.canPublish;
  if (canPublish) {
    const isPublished = isDefinedDate(doc.timestamps.published_at);

    if (isPublished && !(await canDo({ action: 'publish', model, context, doc: doc as never })))
      throw new ForbiddenError('you cannot hide this document when it is published');
  }

  // if the user cannot hide this document, return an error
  if (!(await canDo({ action: 'hide', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot hide this document');

  // set the hidden property in the document
  doc.hidden = hide;

  // set relevant collection metadata
  if (context.profile) {
    doc.people.modified_by = insertUserToArray(doc.people.modified_by, context.profile._id);
    doc.people.last_modified_by = context.profile._id;
    doc.history = [
      ...(doc.history || []),
      {
        type: 'hidden',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save the document
  return await doc.save();
}

export { hideDoc };
