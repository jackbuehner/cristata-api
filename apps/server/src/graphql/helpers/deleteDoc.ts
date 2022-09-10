import { Context } from '../server';
import mongoose from 'mongoose';
import { ForbiddenError } from 'apollo-server-errors';
import { canDo, findDoc, requireAuthentication } from '.';
import { ApolloError } from 'apollo-server-core';

interface DeleteDoc {
  model: string;
  by?: string;
  args: {
    _id: mongoose.Types.ObjectId;
    [key: string]: string | number | Date | mongoose.Types.ObjectId;
  };
  context: Context;
}

async function deleteDoc({ model, by, args, context }: DeleteDoc): Promise<mongoose.Types.ObjectId> {
  requireAuthentication(context);

  // get the document
  const doc = await findDoc({ model, by: by, _id: args[by || '_id'], context, lean: false });
  if (!doc)
    throw new ApolloError(
      'the document you are trying to delete does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the user cannot delete documents in the collection, return an error
  if (!(await canDo({ action: 'delete', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot delete this document');

  // delete the document
  await doc.delete();
  return args._id;
}

export { deleteDoc };
