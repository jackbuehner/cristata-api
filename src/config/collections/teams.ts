import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const teams = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'Team',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: String, required: true, modifiable: true },
      slug: { type: String, required: true, modifiable: true, unique: true },
      members: { type: ['[User]', [mongoose.Schema.Types.ObjectId]], required: true, modifiable: true },
      organizers: { type: ['[User]', [mongoose.Schema.Types.ObjectId]], required: true, modifiable: true },
    },
    Users,
    Teams,
    helpers,
    customQueries: [
      {
        name: 'unassignedUsers',
        description: 'Lists the active users who are not assigned to any teams.',
        pipeline: [
          {
            $group: {
              _id: null,
              allMembers: {
                $addToSet: '$members',
              },
              allOrganizers: {
                $addToSet: '$organizers',
              },
            },
          },
          {
            $addFields: {
              allMembers: {
                $reduce: {
                  input: '$allMembers',
                  initialValue: [],
                  in: {
                    $setUnion: ['$$value', '$$this'],
                  },
                },
              },
              allOrganizers: {
                $reduce: {
                  input: '$allOrganizers',
                  initialValue: [],
                  in: {
                    $setUnion: ['$$value', '$$this'],
                  },
                },
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              let: {
                allMembers: '$allMembers',
                allOrganizers: '$allOrganizers',
              },
              pipeline: [
                {
                  $match: {
                    hidden: false,
                    retired: {
                      $ne: true,
                    },
                  },
                },
                {
                  $addFields: {
                    inTeamMembers: {
                      $in: ['$_id', '$$allMembers'],
                    },
                  },
                },
                {
                  $addFields: {
                    inTeamOrganizers: {
                      $in: ['$_id', '$$allOrganizers'],
                    },
                  },
                },
                {
                  $match: {
                    inTeamMembers: false,
                    inTeamOrganizers: false,
                  },
                },
                {
                  $unset: ['inTeamMembers', 'inTeamOrganizers'],
                },
              ],
              as: 'users',
            },
          },
          {
            $unwind: '$users',
          },
          {
            $replaceRoot: {
              newRoot: '$users',
            },
          },
        ],
        returns: '[User]',
      },
    ],
    actionAccess: (context, doc: ITeam | undefined) => {
      // add user to the organizers array if they are an organizer for the team
      const organizers = [];
      const isOrganizer = doc?.organizers
        .map((o) => o.toHexString())
        .includes(context.profile._id.toHexString());
      if (isOrganizer) organizers.push(context.profile._id);

      // add user to the members array if they are an member of the team
      const members = [];
      const isMember = doc?.members.map((o) => o.toHexString()).includes(context.profile._id.toHexString());
      if (isMember) members.push(context.profile._id);

      return {
        get: { teams: [Teams.ANY], users: [...organizers, ...members] },
        create: { teams: [Teams.MANAGING_EDITOR], users: [] },
        modify: { teams: [Teams.ADMIN], users: [...organizers] },
        hide: { teams: [Teams.MANAGING_EDITOR], users: [...organizers] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        delete: { teams: [Teams.ADMIN], users: [...organizers] },
      };
    },
  });

  return collection;
};

interface ITeam extends CollectionSchemaFields {
  name: string;
  slug: string;
  members: mongoose.Types.ObjectId[];
  organizers: mongoose.Types.ObjectId[];
}

interface ITeamDoc extends ITeam, mongoose.Document {}

export type { ITeam, ITeamDoc };
export { teams };
