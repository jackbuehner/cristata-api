/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose, { FilterQuery } from 'mongoose';
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
  const withStandardPermissions = context.config.collections.find((col) => col.name === model).withPermissions;

  // whether the current user can bypass the access filter
  const canBypassAccessFilter =
    fullAccess ||
    context.profile.teams.includes('000000000000000000000001') ||
    !withStandardPermissions ||
    (await canDo({ action: 'bypassDocPermissions', model, context }));

  // access filter
  const accessFilter = canBypassAccessFilter
    ? {}
    : accessRule
    ? accessRule
    : {
        $or: [
          { 'permissions.teams': { $in: [...context.profile.teams, 0, '0'] } },
          { 'permissions.users': context.profile._id },
          { 'permissions.users': new mongoose.Types.ObjectId('000000000000000000000000') },
        ],
      };

  const pipeline = [
    { $match: accessFilter },
    { $match: { [by || '_id']: _id || null } },
    { $match: filter ? filter : {} },
  ];

  // get the document
  return (await Model.aggregate(pipeline))[0];
}

export { findDoc };
