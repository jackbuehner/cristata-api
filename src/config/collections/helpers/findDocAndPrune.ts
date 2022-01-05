import mongoose, { FilterQuery } from 'mongoose';
import { findDoc, pruneDocs } from '.';
import { Context } from '../../../apollo';

interface FindDocsAndPrune {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  filter?: FilterQuery<unknown>;
  context: Context;
  keep: string[];
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
}

async function findDocAndPrune({
  model,
  by,
  _id,
  filter,
  context,
  keep,
  fullAccess,
  accessRule,
}: FindDocsAndPrune): Promise<mongoose.Document | null> {
  const doc = await findDoc({ model, by, _id, filter, context, fullAccess, accessRule });

  if (doc) {
    const prunedDoc = pruneDocs({
      input: [doc],
      keep,
    })[0];

    return prunedDoc;
  }

  return null;
}

export { findDocAndPrune };
