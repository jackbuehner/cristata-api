/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';

interface WatchDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    watcher?: number;
    watch?: boolean;
  };
  context: Context;
}

async function watchDoc({ model, args, context }: WatchDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.watch === undefined) args.watch = true;
  if (args.watcher === undefined) args.watcher = parseInt(context.profile.id);

  // get the document
  const doc = await findDoc({ model, _id: args._id, context });

  // if the user cannot hide documents in the collection, return an error
  if (!canDo({ action: 'watch', model, context }))
    throw new ForbiddenError('you cannot watch documents in this collection');

  // update document watchers
  if (args.watch) {
    doc.people.watching = [...new Set([...doc.people.watching, args.watcher])]; // adds the user to the array, and then removes duplicates
  } else {
    doc.people.watching = doc.people.watching.filter((github_id) => github_id !== args.watcher);
  }

  // save the document
  return await doc.save();
}

export { watchDoc };
