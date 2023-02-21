/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasKey } from '@jackbuehner/cristata-utils';
import { ApolloError } from 'apollo-server-core';
import mongoose from 'mongoose';
import { requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

interface CreateDoc<DataType> {
  model: string;
  args: {
    name: unknown;
    permissions?: Record<string, mongoose.Types.ObjectId[]>;
    [key: string]: unknown;
  };
  context: Context;
  withPermissions?: boolean;
  modify?: (currentDoc: null, data: DataType) => Promise<void>;
}

async function createDoc<DataType>({ model, args, context, withPermissions, modify }: CreateDoc<DataType>) {
  requireAuthentication(context);
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const Model = await tenantDB.model(model);
  if (!Model) throw new ApolloError('model not found');

  // refuse to create additional document for singleDocument collections
  if (
    context.config.collections.find((c) => c.name === model)?.singleDocument === true &&
    (await Model.countDocuments()) > 0
  ) {
    throw new Error('cannot create additional document in singleDocument collection');
  }

  // add relevant collection metadata
  if (context.profile) {
    args.people = {
      created_by: context.profile._id,
      modified_by: [context.profile._id],
      last_modified_by: context.profile._id,
      watching: [context.profile._id],
    };
  }

  // ensure the current user has permission to view the document
  if (withPermissions && !args.permissions && context.profile) {
    args.permissions = { users: [context.profile._id] };
  }

  // create the new doc with the provided data and the schema defaults
  const newDoc = new Model(args);

  // save the new doc
  const doc = await newDoc.save();

  // if the modify function is defined:
  // modify the document, save the changes to it, and return the changed doc
  if (modify) {
    const data = doc.toObject();

    // execute the modify function
    await modify?.(null, data as unknown as DataType);

    // attempt to patch the article
    return await Model.findByIdAndUpdate(doc._id, { $set: data }, { returnOriginal: false });
  }

  // set history
  if (context.profile && model !== 'Activity') {
    const type = 'created';

    // TODO: remove this in a future version
    args.history = [{ type, user: context.profile._id, at: new Date().toISOString() }];

    createDoc({
      model: 'Activity',
      context,
      args: {
        name: hasKey('name', doc) ? doc.name : undefined,
        type,
        colName: model,
        docId: doc._id,
        userIds: [context.profile._id],
        at: new Date(),
      },
    });
  }

  // return the doc
  return doc;
}

export { createDoc };
