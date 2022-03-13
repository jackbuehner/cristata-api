/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose, { FilterQuery } from 'mongoose';
import { Teams, Users } from '../../../config/database';
import { canDo, CollectionDoc, requireAuthentication } from '.';

interface FindDoc {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  filter?: FilterQuery<unknown>;
  context: Context;
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
}

async function findDoc({ model, by, _id, filter, context, fullAccess, accessRule }: FindDoc) {
  if (!fullAccess) requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  // whether the collection docs contain the standard teams and user permissions object
  const withStandardPermissions = context.config.database.collections.find(
    (col) => col.name === model
  ).withPermissions;

  // whether the current user can bypass the access filter
  const canBypassAccessFilter =
    fullAccess ||
    context.profile.teams.includes(Teams.ADMIN) ||
    !withStandardPermissions ||
    canDo({ action: 'bypassDocPermissions', model, context });

  // access filter
  const accessFilter = canBypassAccessFilter
    ? {}
    : accessRule
    ? accessRule
    : {
        $or: [
          { 'permissions.teams': { $in: [...context.profile.teams, Teams.ANY] } },
          { 'permissions.users': context.profile._id },
          { 'permissions.users': Users.ANY },
        ],
      };

  // get the document
  return await Model.findOne({ [by || '_id']: _id || null, ...accessFilter, ...filter });
}

export { findDoc };
