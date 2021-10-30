/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose, { FilterQuery } from 'mongoose';
import { Teams } from '../../database';
import { CollectionDoc, requireAuthentication } from '.';

interface FindDocs {
  model: string;
  args: {
    _ids?: mongoose.Types.ObjectId[];
    filter?: FilterQuery<unknown>;
    sort?: string | Record<string, unknown>;
    page?: number;
    offset?: number;
    limit: number;
  };
  context: Context;
  fullAccess?: boolean;
}

function findDocs({ model, args, context, fullAccess }: FindDocs) {
  if (!fullAccess) requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  const { _ids, filter, page, offset } = args;
  let { limit, sort } = args;

  if (limit > 100) limit = 100; // never send more than 100 docs per page
  if (!sort) sort = { 'timestamps.created_at': 1 };

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

  // @ts-expect-error aggregatePaginate DOES exist.
  // The types for the plugin have not been updated for newer versions of mongoose.
  return Model.aggregatePaginate(
    [
      { $match: accessFilter },
      { $match: _ids ? { _id: { $in: _ids } } : {} },
      { $match: filter ? filter : {} },
    ],
    { sort, page, offset, limit }
  );
}

export { findDocs };
