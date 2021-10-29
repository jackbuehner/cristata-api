/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { Teams } from '../../database';
import { CollectionDoc } from '.';

interface FindDoc {
  model: string;
  _id: mongoose.Types.ObjectId;
  context: Context;
}

function findDoc({ model, _id, context }: FindDoc) {
  const Model = mongoose.model<CollectionDoc>(model);

  // access filter
  const accessFilter = context.profile.teams.includes(Teams.ADMIN)
    ? {}
    : {
        $or: [
          { 'permissions.teams': { $in: context.profile.teams } },
          { 'permissions.users': context.profile.id },
        ],
      };

  // get the document
  return Model.findById(_id, accessFilter);
}

export { findDoc };
