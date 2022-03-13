/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import { DateScalar, JsonScalar, ObjectIdScalar, VoidScalar } from '../scalars';
import mongoose from 'mongoose';
import { getUsers } from '../helpers';
import { Teams } from '../../../config/database';

const core = {
  Date: DateScalar,
  ObjectID: ObjectIdScalar,
  JSON: JsonScalar,
  Void: VoidScalar,
  Query: {
    collectionActivity: async (_, { limit, collections, exclude, page }, context: Context) => {
      let collectionNames = context.config.database.collections.map((col) => col.name);
      if (collections) collectionNames = collectionNames.filter((name) => collections.includes(name));
      else if (exclude) collectionNames = collectionNames.filter((name) => !exclude.includes(name));

      const collectionNamesPluralized = collectionNames.map((name) => mongoose.pluralize()(name));

      const Model = mongoose.model(collectionNames[0]);

      const pipeline: mongoose.PipelineStage[] = [
        { $addFields: { in: collectionNamesPluralized[0] } },
        ...collectionNamesPluralized.map((collectionName) => ({
          $unionWith: {
            coll: collectionName,
            pipeline: [{ $addFields: { in: collectionName } }],
          },
        })),
        { $unwind: { path: '$history' } },
        {
          $project: {
            // _id: projected by default
            in: 1,
            name: 1,
            'permissions.teams': 1,
            'permissions.users': 1,
            user: '$history.user',
            action: '$history.type',
            at: '$history.at',
          },
        },
        { $sort: { at: -1 } },
        {
          $match: context.profile.teams.includes(Teams.ADMIN)
            ? {}
            : {
                $or: [
                  { 'permissions.teams': { $in: context.profile.teams } },
                  { 'permissions.users': context.profile._id },
                ],
              },
        },
        { $limit: limit },
      ];

      const aggregate = Model.aggregate(pipeline);

      // @ts-expect-error aggregatePaginate DOES exist.
      // The types for the plugin have not been updated for newer versions of mongoose.
      return Model.aggregatePaginate(aggregate, { page, limit });
    },
  },
  CollectionActivity: {
    user: ({ user }) => getUsers(user),
  },
  CollectionPermissions: {
    users: ({ users }) => getUsers(users),
  },
};

export { core };
