import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, CollectionDoc, findDoc, requireAuthentication } from '.';

interface DeleteDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
    by?: string;
  };
  context: Context;
}

async function deleteDoc({ model, args, context }: DeleteDoc): Promise<mongoose.Types.ObjectId> {
  requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  // get the document
  const doc = await findDoc({ model, by: args.by, _id: args[args.by || '_id'], context });

  // if the user cannot delete documents in the collection, return an error
  if (!canDo({ action: 'delete', model, context, doc: doc as never }))
    throw new ForbiddenError('you cannot delete this document');

  // delete the document
  await Model.deleteOne({ _id: args._id });
  return args._id;
}

export { deleteDoc };
