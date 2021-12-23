/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';

interface LockDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    lock?: boolean;
  };
  context: Context;
  publishable?: boolean;
}

async function lockDoc({ model, args, context, publishable }: LockDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.lock === undefined) args.lock = true;
  if (publishable === undefined) publishable = false;

  // get the document
  const doc = await findDoc({ model, _id: args._id, context });

  // if the document is currently published, do not modify unless user can publish
  if (publishable) {
    const isPublished = !!doc.timestamps.published_at;

    if (isPublished && !canDo({ action: 'publish', model, context }))
      throw new ForbiddenError('you cannot lock published documents in this collection');
  }

  // if the user cannot lock documents in the collection, return an error
  if (!canDo({ action: 'lock', model, context }))
    throw new ForbiddenError('you cannot lock documents in this collection');

  // set the locked property in the document
  doc.locked = args.lock;

  // set relevant collection metadata
  doc.people.modified_by = [...new Set([...doc.people.modified_by, context.profile._id])];
  doc.people.last_modified_by = context.profile._id;
  doc.history = [
    ...doc.history,
    {
      type: 'locked',
      user: context.profile._id,
      at: new Date().toISOString(),
    },
  ];

  // save the document
  return await doc.save();
}

export { lockDoc };
