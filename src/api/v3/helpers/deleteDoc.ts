import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';

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

  // get the document
  const doc = await findDoc({ model, by: args.by, _id: args[args.by || '_id'], context, lean: false });

  // if the user cannot delete documents in the collection, return an error
  if (!(await canDo({ action: 'delete', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot delete this document');

  // delete the document
  await doc.delete();
  return args[args.by || '_id'];
}

export { deleteDoc };
