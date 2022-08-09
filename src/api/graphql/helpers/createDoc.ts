/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from '../server';
import mongoose from 'mongoose';
import { requireAuthentication } from '.';
import { TenantDB } from '../../mongodb/TenantDB';

interface CreateDoc<DataType> {
  model: string;
  args: {
    name: string;
    permissions: Record<string, mongoose.Types.ObjectId[]>;
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

  // refuse to create additional document for singleDocument collections
  if (
    context.config.collections.find((c) => c.name === model).singleDocument === true &&
    (await Model.countDocuments()) > 0
  ) {
    throw new Error('cannot create additional document in singleDocument collection');
  }

  // add relevant collection metadata
  args.people = {
    created_by: context.profile._id,
    modified_by: [context.profile._id],
    last_modified_by: context.profile._id,
    watching: [context.profile._id],
  };
  args.history = [
    {
      type: 'created',
      user: context.profile._id,
      at: new Date().toISOString(),
    },
  ];

  // ensure the current user has permission to view the document
  if (withPermissions && !args.permissions) args.permissions = { users: [context.profile._id] };

  // create the new doc with the provided data and the schema defaults
  const newDoc = new Model(args);

  // save the new doc
  const doc = await newDoc.save();

  // if the modify function is defined:
  // modify the document, save the changes to it, and return the changed doc
  if (modify) {
    const data = doc.toObject() as unknown as DataType;

    // execute the modify function
    await modify?.(null, data);

    // attempt to patch the article
    return await Model.findByIdAndUpdate(doc._id, { $set: data }, { returnOriginal: false });
  }

  // return the doc
  return doc;
}

export { createDoc };
