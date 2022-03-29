/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';

interface HideDoc {
  model: string;
  args: {
    by?: string;
    _id: mongoose.Types.ObjectId;
    hide?: boolean;
  };
  context: Context;
  publishable?: boolean;
}

async function hideDoc({ model, args, context, publishable }: HideDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.hide === undefined) args.hide = true;
  if (publishable === undefined) publishable = false;

  // get the document
  const doc = await findDoc({ model, by: args.by, _id: args[args.by || '_id'], context, lean: false });

  // throw error if user cannot view the doc
  if (!doc)
    throw new ApolloError(
      'the document you are trying to hide does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the document is currently published, do not modify unless user can publish
  if (publishable) {
    const isPublished = !!doc.timestamps.published_at;

    if (isPublished && !(await canDo({ action: 'publish', model, context, doc: doc as never })))
      throw new ForbiddenError('you cannot hide this document when it is published');
  }

  // if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'hide', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot hide this document');

  // set the hidden property in the document
  doc.hidden = args.hide;

  // set relevant collection metadata
  doc.people.modified_by = [...new Set([...doc.people.modified_by, context.profile._id])];
  doc.people.last_modified_by = context.profile._id;
  doc.history = [
    ...doc.history,
    {
      type: 'hidden',
      user: context.profile._id,
      at: new Date().toISOString(),
    },
  ];

  // save the document
  return await doc.save();
}

export { hideDoc };
