import { Context, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { UsersType, TeamsType } from '../../types/config';

const teams = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const {
    canDo,
    createDoc,
    deleteDoc,
    findDoc,
    genSchema,
    findDocs,
    getCollectionActionAccess,
    getUsers,
    gql,
    hideDoc,
    lockDoc,
    modifyDoc,
    watchDoc,
    withPubSub,
  } = helpers;

  const name = 'Team';
  const canPublish = false;
  const withPermissions = false;
  const withSubscription = true;

  const { typeDefs, schemaFields } = genSchema({
    name,
    canPublish,
    withPermissions,
    withSubscription,
    Users,
    Teams,
    schemaDef: {
      name: { type: String, required: true, modifiable: true },
      slug: { type: String, required: true, modifiable: true, unique: true },
      members: { type: ['[User]', [mongoose.Schema.Types.ObjectId]], required: true, modifiable: true },
      organizers: { type: ['[User]', [mongoose.Schema.Types.ObjectId]], required: true, modifiable: true },
    },
  });

  return {
    name,
    canPublish,
    withPermissions,
    typeDefs:
      typeDefs +
      gql`
      type Query {
        """
        Lists the active users who are not assigned to any teams.
        """
        teamUnassignedUsers(): [User]
      }
    `,
    resolvers: {
      Query: {
        team: (_, args, context: Context) => findDoc({ model: 'Team', _id: args._id, context }),
        teams: (_, args, context: Context) => findDocs({ model: 'Team', args, context }),
        teamActionAccess: (_, args, context: Context) =>
          getCollectionActionAccess({ model: 'Team', context, args }),
        teamUnassignedUsers: async (_, __, context: Context) => {
          // allow any user with GET user permissions to get users who are not assigned to any teams
          if (canDo({ model: 'User', action: 'get', context })) {
            const allMembers: mongoose.Types.ObjectId[] = await mongoose.model('Team').distinct('members');
            const allOrganizers: mongoose.Types.ObjectId[] = await mongoose
              .model('Team')
              .distinct('organizers');
            const allAssigned = Array.from(new Set([...allMembers, ...allOrganizers]));
            // find users who are not hidden, not retired, and are not assigned to a team
            return await mongoose
              .model('User')
              .find({ _id: { $nin: allAssigned }, hidden: false, retired: { $ne: true } });
          }
          return [];
        },
      },
      Mutation: {
        teamCreate: async (_, args, context: Context) =>
          withPubSub('TEAM', 'CREATED', createDoc({ model: 'Team', args, context })),
        teamModify: (_, { _id, input }, context: Context) =>
          withPubSub('TEAM', 'MODIFIED', modifyDoc({ model: 'Team', data: { ...input, _id }, context })),
        teamHide: async (_, args, context: Context) =>
          withPubSub('TEAM', 'MODIFIED', hideDoc({ model: 'Team', args, context })),
        teamLock: async (_, args, context: Context) =>
          withPubSub('TEAM', 'MODIFIED', lockDoc({ model: 'Team', args, context })),
        teamWatch: async (_, args, context: Context) =>
          withPubSub('TEAM', 'MODIFIED', watchDoc({ model: 'Team', args, context })),
        teamDelete: async (_, args, context: Context) =>
          withPubSub('TEAM', 'DELETED', deleteDoc({ model: 'Team', args, context })),
      },
      Subscription: {
        teamCreated: { subscribe: () => pubsub.asyncIterator(['TEAM_CREATED']) },
        teamModified: { subscribe: () => pubsub.asyncIterator(['TEAM_MODIFIED']) },
        teamDeleted: { subscribe: () => pubsub.asyncIterator(['TEAM_DELETED']) },
      },
      Team: {
        members: ({ members }) => getUsers(members),
        organizers: ({ organizers }) => getUsers(organizers),
      },
    },
    schemaFields,
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
  };
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
