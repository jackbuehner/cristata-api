/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-express';
import { canDo, findDoc } from '.';

interface HideDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    hide?: boolean;
  };
  context: Context;
  publishable?: boolean;
}

async function hideDoc({ model, args, context, publishable }: HideDoc) {
  // set defaults
  if (args.hide === undefined) args.hide = true;
  if (publishable === undefined) publishable = false;

  // get the document
  const doc = await findDoc({ model, _id: args._id, context });

  // if the document is currently published, do not modify unless user can publish
  if (publishable) {
    const isPublished = !!doc.timestamps.published_at;

    if (isPublished && !canDo({ action: 'publish', model, context }))
      throw new ForbiddenError('you cannot hide published documents in this collection');
  }

  // if the user cannot hide documents in the collection, return an error
  if (!canDo({ action: 'hide', model, context }))
    throw new ForbiddenError('you cannot hide documents in this collection');

  // set the hidden property in the document
  doc.hidden = args.hide;

  // set relevant collection metadata
  doc.people.modified_by = [...new Set([...doc.people.modified_by, parseInt(context.profile.id)])];
  doc.people.last_modified_by = parseInt(context.profile.id);
  doc.history = [
    ...doc.history,
    {
      type: 'hidden',
      user: parseInt(context.profile._id),
      at: new Date().toISOString(),
    },
  ];

  // save the document
  return await doc.save();
}

export { hideDoc };
