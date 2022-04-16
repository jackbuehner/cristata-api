/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';
import { insertUserToArray } from '../../../utils/insertUserToArray';

interface WatchDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    watcher?: mongoose.Types.ObjectId;
    watch?: boolean;
  };
  context: Context;
}

async function watchDoc({ model, args, context }: WatchDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.watch === undefined) args.watch = true;
  if (args.watcher === undefined) args.watcher = context.profile._id;

  // get the document
  const doc = await findDoc({ model, _id: args._id, context, lean: false });

  // if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'watch', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot watch this document');

  // update document watchers
  if (args.watch) {
    doc.people.watching = insertUserToArray(doc.people.watching, args.watcher); // adds the user to the array, and then removes duplicates
  } else {
    doc.people.watching = doc.people.watching.filter((_id) => _id !== args.watcher);
  }

  // save the document
  return await doc.save();
}

export { watchDoc };
