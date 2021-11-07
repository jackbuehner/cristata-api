/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { requireAuthentication } from './';

interface CreateDoc {
  model: string;
  args: {
    github_id?: number;
    name: string;
    [key: string]: unknown;
  };
  context: Context;
}

async function createDoc({ model, args, context }: CreateDoc) {
  requireAuthentication(context);
  const Model = mongoose.model(model);

  // add relevant collection metadata
  args.people = {
    created_by: parseInt(context.profile._id),
    modified_by: [parseInt(context.profile._id)],
    last_modified_by: parseInt(context.profile._id),
    watching: [parseInt(context.profile._id)],
  };
  args.history = [
    {
      type: 'created',
      user: parseInt(context.profile._id),
      at: new Date().toISOString(),
    },
  ];

  // create the new doc with the provided data and the schema defaults
  const newDoc = new Model(args);

  // save and return the new doc
  return await newDoc.save();
}

export { createDoc };
