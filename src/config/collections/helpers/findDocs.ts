/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import mongoose, { FilterQuery } from 'mongoose';
import { Teams, Users } from '../../database';
import { CollectionDoc, requireAuthentication } from '.';
import { flattenObject } from '../../../utils/flattenObject';

interface FindDocs {
  model: string;
  args: {
    _ids?: mongoose.Types.ObjectId[];
    filter?: FilterQuery<unknown>;
    sort?: string | Record<string, unknown>;
    page?: number;
    offset?: number;
    limit: number;
    pipeline2?: mongoose.PipelineStage[];
  };
  context: Context;
  fullAccess?: boolean;
  accessRule?: FilterQuery<unknown>;
}

async function findDocs({ model, args, context, fullAccess, accessRule }: FindDocs) {
  if (!fullAccess) requireAuthentication(context);
  const Model = mongoose.model<CollectionDoc>(model);

  const { _ids, filter, offset } = args;
  let { limit, sort, page } = args;

  if (limit > 100) limit = 100; // never send more than 100 docs per page
  if (!sort) sort = { 'timestamps.created_at': 1 };

  if (!offset && !page) page = 1; // default to page 1

  // access filter
  const accessFilter =
    fullAccess || context.profile.teams.includes(Teams.ADMIN)
      ? {}
      : accessRule
      ? accessRule
      : {
          $or: [
            { 'permissions.teams': { $in: context.profile.teams } },
            { 'permissions.users': context.profile._id },
            { 'permissions.users': Users.ANY },
          ],
        };

  // add temporary fields for timestamps that speciify whether they are greater
  // than the baseline date meant for use in `accessFilter`
  // (field names are key + _is_baseline)
  const timestampBaselineBooleanFields = [
    ...new Set(
      Object.keys(flattenObject(Model.schema.obj as { [x: string]: never }))
        .filter((key) => key.includes('timestamps.obj'))
        .filter((key) => !key.includes('id'))
        .map((key) =>
          key.replace('.type', '').replace('.default', '').replace('.obj', '').replace('.required', '')
        )
    ),
  ].map((key) => ({
    $addFields: {
      [key + '_is_baseline']: {
        $or: [
          { $eq: ['$' + key, new Date('0001-01-01T01:00:00.000+00:00')] },
          { $cond: [{ $lte: ['$' + key, null] }, true, false] },
        ],
      },
    },
  }));

  const pipeline = [
    ...timestampBaselineBooleanFields,
    { $match: accessFilter },
    { $match: _ids ? { _id: { $in: _ids } } : {} },
    { $match: filter ? filter : {} },
    ...(args.pipeline2 || []),
  ];

  const aggregate = Model.aggregate(pipeline);

  // offset and page or incompatable, so do not pass page variable when offset is defined
  if (offset !== undefined) {
    // @ts-expect-error aggregatePaginate DOES exist.
    // The types for the plugin have not been updated for newer versions of mongoose.
    return await Model.aggregatePaginate(aggregate, { sort, offset, limit });
  }
  // @ts-expect-error aggregatePaginate DOES exist.
  // The types for the plugin have not been updated for newer versions of mongoose.
  return await Model.aggregatePaginate(aggregate, { sort, page, limit });
}

export { findDocs };
