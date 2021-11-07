import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, CollectionDoc, requireAuthentication } from '.';

interface DeleteDoc {
  model: string;
  args: {
    _id: mongoose.Types.ObjectId;
  };
  context: Context;
}

async function deleteDoc({ model, args, context }: DeleteDoc): Promise<void> {
  requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  // if the user cannot delete documents in the collection, return an error
  if (!canDo({ action: 'delete', model, context }))
    throw new ForbiddenError('you cannot delete documents in this collection');

  // delete the document
  await Model.deleteOne({ _id: args._id });
  return;
}

export { deleteDoc };
