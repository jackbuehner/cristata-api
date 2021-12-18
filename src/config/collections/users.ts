import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields, GitHubTeamNodeID, GitHubUserID } from '../../mongodb/db';
import {
  createDoc,
  deleteDoc,
  findDoc,
  findDocAndPrune,
  findDocs,
  findDocsAndPrune,
  getCollectionActionAccess,
  hideDoc,
  lockDoc,
  modifyDoc,
  watchDoc,
  withPubSub,
} from './helpers';

const PRUNED_USER_KEEP_FIELDS = [
  '_id',
  'name',
  'github_id',
  'current_title',
  'email',
  'biography',
  'twitter',
  'photo',
  'slug',
  'group',
];

const users: Collection = {
  name: 'User',
  canPublish: false,
  withPermissions: false,
  typeDefs: gql`
    type User inherits Collection, WithPermissions {
      name: String!
      slug: String!
      phone: String
      email: String
      twitter: String
      biography: String
      current_title: String
      timestamps: UserTimestamps
      photo: String
      github_id: Int
      teams: [String]
      group: Float
    }

    type UserTimestamps inherits CollectionTimestamps {
      joined_at: Date!
      left_at: Date!
      last_login_at: Date!
    }

    type PrunedUser {
      _id: ObjectID!
      name: String!
      slug: String!
      email: String
      twitter: String
      biography: String
      current_title: String
      photo: String
      github_id: Int
      group: Float
    }

    input UserModifyInput {
      name: String!
      slug: String
      phone: String
      email: String
      twitter: String
      biography: String
      current_title: String
      photo: String
      github_id: Int
      teams: [String]
      group: Float
    }

    type Query {
      """
      Get a user by _id. If _id is omitted, the API will return the current
      user.
      """
      user(_id: ObjectID): User
      """
      Get a user by _id with confidential information pruned.
      """
      userPublic(_id: ObjectID!): PrunedUser
      """
      Get a set of users. If _ids is omitted, the API will return all users.
      """
      users(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<User>
      """
      Get a set of users with confidential information pruned. If _ids is
      omitted, the API will return all users.
      """
      usersPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<PrunedUser>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      userActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new user.
      """
      userCreate(github_id: Int, name: String!): User
      """
      Modify an existing user.
      """
      userModify(_id: ObjectID!, input: UserModifyInput!): User
      """
      Toggle whether the hidden property is set to true for an existing user.
      This mutation sets hidden: true by default.
      Hidden users should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      userHide(_id: ObjectID!, hide: Boolean): User
      """
      Toggle whether the locked property is set to true for an existing user.
      This mutation sets locked: true by default.
      Locked users should only be editable by the server and by admins.
      """
      userLock(_id: ObjectID!, lock: Boolean): User
      """
      Add a watcher to a user.
      This mutation adds the watcher by default.
      This mutation will use the signed in user if watcher is not defined.
      """
      userWatch(_id: ObjectID!, watcher: Int, watch: Boolean): User
      """
      Deletes a user account.
      """
      userDelete(_id: ObjectID!): Void
    }

    extend type Subscription {
      """
      Sends user documents when they are created.
      """
      userCreated(): User
      """
      Sends the updated user document when it changes.
      If _id is omitted, the server will send changes for all users.
      """
      userModified(_id: ObjectID): User
      """
      Sends user _id when it is deleted.
      If _id is omitted, the server will send _ids for all deleted users.
      """
      userDeleted(_id: ObjectID): User
    }
  `,
  resolvers: {
    Query: {
      user: (_, args, context: Context) =>
        findDoc({
          model: 'User',
          _id: args._id || new mongoose.Types.ObjectId(context.profile._id),
          context,
        }),
      userPublic: (_, args, context: Context) =>
        findDocAndPrune({
          model: 'User',
          _id: args._id,
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        }),
      users: (_, args, context: Context) => findDocs({ model: 'User', args, context }),
      usersPublic: async (_, args, context: Context) =>
        findDocsAndPrune({
          model: 'User',
          args,
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        }),
      userActionAccess: (_, __, context: Context) => getCollectionActionAccess({ model: 'User', context }),
    },
    Mutation: {
      userCreate: async (_, args, context: Context) =>
        withPubSub('USER', 'CREATED', createDoc({ model: 'User', args, context })),
      userModify: (_, { _id, input }, context: Context) =>
        withPubSub('USER', 'MODIFIED', modifyDoc({ model: 'User', data: { ...input, _id }, context })),
      userHide: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', hideDoc({ model: 'User', args, context })),
      userLock: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', lockDoc({ model: 'User', args, context })),
      userWatch: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', watchDoc({ model: 'User', args, context })),
      userDelete: async (_, args, context: Context) =>
        withPubSub('USER', 'DELETED', deleteDoc({ model: 'User', args, context })),
    },
    Subscription: {
      userCreated: { subscribe: () => pubsub.asyncIterator(['USER_CREATED']) },
      userModified: { subscribe: () => pubsub.asyncIterator(['USER_MODIFIED']) },
      userDeleted: { subscribe: () => pubsub.asyncIterator(['USER_DELETED']) },
    },
  },
  schemaFields: () => ({
    name: { type: String, required: true, default: 'New User' },
    slug: { type: String, required: true, default: 'new-user' },
    phone: { type: Number },
    email: { type: String },
    twitter: { type: String },
    biography: { type: String },
    current_title: { type: String },
    timestamps: {
      joined_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
      left_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
      last_login_at: { type: Date, default: new Date().toISOString() },
    },
    photo: { type: String },
    versions: { type: {} },
    github_id: { type: Number },
    teams: { type: [String] },
    group: { type: Number, default: '5.10' },
  }),
  permissions: (Users, Teams) => ({
    get: { teams: [Teams.ANY], users: [] },
    create: { teams: [Teams.ANY], users: [] },
    modify: { teams: [Teams.ANY], users: [] },
    hide: { teams: [Teams.ANY], users: [] },
    lock: { teams: [Teams.ADMIN], users: [] },
    watch: { teams: [Teams.ANY], users: [] },
    delete: { teams: [Teams.ADMIN], users: [] },
  }),
};

interface IUser extends CollectionSchemaFields {
  name: string;
  slug: string;
  phone?: number;
  email?: string;
  twitter?: string;
  biography?: string;
  current_title?: string;
  timestamps: IUserTimestamps & CollectionSchemaFields['timestamps'];
  photo?: string; // url to photo
  versions: IUser[]; // store previous versions of the user profile (only via v2 api)
  github_id: GitHubUserID;
  teams: GitHubTeamNodeID[];
  group?: number;
}

interface IUserTimestamps {
  joined_at: string; // ISO string
  left_at: string; // ISO string
  last_login_at: string; // ISO string
}

interface IUserDoc extends IUser, mongoose.Document {}

export type { IUser, IUserDoc };
export { users, PRUNED_USER_KEEP_FIELDS };
