/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose from 'mongoose';
import { Teams } from '../../database';
import { CollectionDoc, requireAuthentication } from '.';

interface FindDoc {
  model: string;
  _id: mongoose.Types.ObjectId;
  context: Context;
  fullAccess?: boolean;
}

function findDoc({ model, _id, context, fullAccess }: FindDoc) {
  if (!fullAccess) requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  // access filter
  const accessFilter =
    fullAccess || context.profile.teams.includes(Teams.ADMIN)
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
