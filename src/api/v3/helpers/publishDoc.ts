/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';
import { insertUserToArray } from '../../../utils/insertUserToArray';

interface PublishDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    published_at?: string; // ISO date string
    publish?: boolean;
  };
  context: Context;
}

async function publishDoc({ model, args, context }: PublishDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.publish === undefined) args.publish = true;
  if (args.published_at === undefined) args.published_at = new Date().toISOString();

  // get the document
  const doc = await findDoc({ model, _id: args._id, context, lean: false });

  //if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'publish', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot publish this document');

  // set the publish properties
  if (args.publish) {
    doc.timestamps.published_at = args.published_at;
    doc.people.published_by = insertUserToArray(doc.people.published_by, context.profile._id);
    doc.people.last_published_by = context.profile._id;
  }

  // set relevant collection metadata
  doc.people.modified_by = insertUserToArray(doc.people.modified_by, context.profile._id);
  doc.people.last_modified_by = context.profile._id;
  doc.history = [
    ...doc.history,
    {
      type: 'published',
      user: context.profile._id,
      at: new Date().toISOString(),
    },
  ];

  // save the document
  return await doc.save();
}

export { publishDoc };
