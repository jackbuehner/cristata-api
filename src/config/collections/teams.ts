import { Context } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { UsersType, TeamsType } from '../../types/config';
import { merge } from 'merge-anything';

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
    actionAccess: (context: Context, doc: ITeam | undefined) => {
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

  collection.typeDefs += helpers.gql`
  type Query {
    """
    Lists the active users who are not assigned to any teams.
    """
    teamUnassignedUsers(): [User]
  }`;

  collection.resolvers = merge(collection.resolvers, {
    Query: {
      teamUnassignedUsers: async (_, __, context: Context) => {
        // allow any user with GET user permissions to get users who are not assigned to any teams
        if (helpers.canDo({ model: 'User', action: 'get', context })) {
          const allMembers: mongoose.Types.ObjectId[] = await mongoose.model('Team').distinct('members');
          const allOrganizers: mongoose.Types.ObjectId[] = await mongoose.model('Team').distinct('organizers');
          const allAssigned = Array.from(new Set([...allMembers, ...allOrganizers]));
          // find users who are not hidden, not retired, and are not assigned to a team
          return await mongoose
            .model('User')
            .find({ _id: { $nin: allAssigned }, hidden: false, retired: { $ne: true } });
        }
        return [];
      },
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
