/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';

async function createDoc(model: string, data: any, context: Context) {
  const Model = mongoose.model(model);

  // add relevant collection metadata
  data.people = {
    created_by: parseInt(context.profile._id),
    modified_by: [parseInt(context.profile._id)],
    last_modified_by: parseInt(context.profile._id),
    watching: [parseInt(context.profile._id)],
  };
  data.history = [
    {
      type: 'created',
      user: parseInt(context.profile._id),
      at: new Date().toISOString(),
    },
  ];

  // create the new doc with the provided data and the schema defaults
  const newDoc = new Model(data);

  // save and return the new doc
  return await newDoc.save();
}

export { createDoc };
