/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose, { FilterQuery } from 'mongoose';
import { requireAuthentication } from '.';
import { findDoc } from './findDoc';
import { createDoc } from './createDoc';

interface FindOrCreateDoc<DataType> {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  args: {
    name: string;
    permissions: Record<string, mongoose.Types.ObjectId[]>;
    filter?: FilterQuery<unknown>;
    [key: string]: unknown;
  };
  context: Context;
  withPermissions?: boolean;
  lean?: boolean;
  modify?: (currentDoc: null, data: DataType) => Promise<void>;
}

async function findOrCreateDoc<DataType>({
  model,
  args,
  _id,
  by,
  context,
  withPermissions,
  modify,
}: FindOrCreateDoc<DataType>) {
  requireAuthentication(context);

  const doc = findDoc({
    _id,
    context,
    model,
    by,
    filter: args.filter,
    fullAccess: withPermissions === false,
  });

  if (!doc) {
    return createDoc({ args, context, model, modify, withPermissions });
  }

  // return the doc
  return doc;
}

export { findOrCreateDoc };
