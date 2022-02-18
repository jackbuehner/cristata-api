import { Context, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';

const teams = (helpers: Helpers): Collection => {
  const {
    canDo,
    createDoc,
    deleteDoc,
    findDoc,
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

  return {
    name: 'Team',
    canPublish: false,
    withPermissions: false,
    typeDefs: gql`
      type Team inherits Collection {
        name: String!
        slug: String!
        members: [User]!
        organizers: [User]!
      }
  
      input TeamModifyInput {
        name: String
        slug: String
        members: [ObjectID]
        organizers: [ObjectID]
      }
  
      type Query {
        """
        Get a team by _id.
        """
        team(_id: ObjectID!): Team
        """
        Get a set of teams. If _ids is omitted, the API will return all teams.
        """
        teams(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Team>
        """
        Get the permissions of the currently authenticated user for this
        collection.
        """
        teamActionAccess(_id: ObjectID): CollectionActionAccess
        """
        Lists the active users who are not assigned to any teams.
        """
        teamUnassignedUsers(): [User]
      }
  
      type Mutation {
        """
        Create a new team.
        """
        teamCreate(name: String!, slug: String!, members: [ObjectID]!, organizers: [ObjectID]!): Team
        """
        Modify an existing team.
        """
        teamModify(_id: ObjectID!, input: TeamModifyInput!): Team
        """
        Toggle whether the hidden property is set to true for an existing team.
        This mutation sets hidden: true by default.
        Hidden teams should not be presented to clients; this should be used as
        a deletion that retains the data in case it is needed later.
        """
        teamHide(_id: ObjectID!, hide: Boolean): Team
        """
        Toggle whether the locked property is set to true for an existing team.
        This mutation sets locked: true by default.
        Locked teams should only be editable by the server and by admins.
        """
        teamLock(_id: ObjectID!, lock: Boolean): Team
        """
        Add a watcher to a team.
        This mutation adds the watcher by default.
        This mutation will use the signed in team if watcher is not defined.
        """
        teamWatch(_id: ObjectID!, watcher: ObjectID, watch: Boolean): Team
        """
        Deletes a team account.
        """
        teamDelete(_id: ObjectID!): Void
      }
  
      extend type Subscription {
        """
        Sends team documents when they are created.
        """
        teamCreated(): Team
        """
        Sends the updated team document when it changes.
        If _id is omitted, the server will send changes for all teams.
        """
        teamModified(_id: ObjectID): Team
        """
        Sends team _id when it is deleted.
        If _id is omitted, the server will send _ids for all deleted teams.
        """
        teamDeleted(_id: ObjectID): Team
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
    schemaFields: () => ({
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      members: { type: [mongoose.Schema.Types.ObjectId], required: true },
      organizers: { type: [mongoose.Schema.Types.ObjectId], required: true },
    }),
    actionAccess: (Users, Teams, context: Context, doc: ITeam | undefined) => {
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
