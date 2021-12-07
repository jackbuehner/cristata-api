import mongoose, { FilterQuery } from 'mongoose';
import { findDoc, pruneDocs } from '.';
import { Context } from '../../../apollo';

interface FindDocsAndPrune {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId;
  filter?: FilterQuery<unknown>;
  context: Context;
  keep: string[];
  fullAccess?: boolean;
}

async function findDocAndPrune({
  model,
  by,
  _id,
  filter,
  context,
  keep,
  fullAccess,
}: FindDocsAndPrune): Promise<mongoose.Document> {
  const doc = await findDoc({ model, by, _id, filter, context, fullAccess });

  const prunedDoc = pruneDocs({
    input: [doc],
    keep,
  })[0];

  return prunedDoc;
}

export { findDocAndPrune };
