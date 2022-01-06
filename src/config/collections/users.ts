import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose, { PassportLocalDocument } from 'mongoose';
import { CollectionSchemaFields, GitHubTeamNodeID } from '../../mongodb/db';
import {
  canDo,
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
  requireAuthentication,
  watchDoc,
  withPubSub,
} from './helpers';
import { ForbiddenError } from 'apollo-server-errors';
import generator from 'generate-password';
import { sendEmail } from '../../utils/sendEmail';
import { getPasswordStatus } from '../../utils/getPasswordStatus';
import { slugify } from '../../utils/slugify';

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
      username: String
      slug: String!
      phone: String
      email: String
      twitter: String
      biography: String
      current_title: String
      timestamps: UserTimestamps
      photo: String
      github_id: Int
      teams(_id: ObjectID!, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Team>
      group: Float
      retired: Boolean
      flags: [String]!
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
      name: String
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

    type UserExistsResponse {
      exists: Boolean!
      methods: [String]!
      doc: PrunedUser
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
      Get a user by slug with confidential information pruned.
      """
      userPublicBySlug(slug: String!): PrunedUser
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
      """
      Returns whether the username exists in the database.
      Also return the pruned user.
      """
      userExists(username: String!): UserExistsResponse!
      """
      Returns the sign-on methods for the username.
      """
      userMethods(username: String!): [String]!
    }

    type Mutation {
      """
      Create a new user.
      """
      userCreate(name: String!, email: String!, current_title: String!, username: String!, slug: String!, phone: String): User
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
      """
      Change the password for the current user.
      """
      userPasswordChange(oldPassword: String!, newPassword: String!): User
      """
      Toggle whether aan existing user is deactivated.
      This mutation deactivates by default.
      """
      userDeactivate(_id: ObjectID!, deactivate: Boolean): User
      """
      Resend an invitation for a user with a temporary password.
      """
      userResendInvite(_id: ObjectID!): User
      """
      Migrate a user without a local account.
      
      Sends a email with the new user's new username and temporary password.

      The user must sign in with the local account at least once within 48
      hours to prevent their account from becoming inaccessable.
      """
      userMigrateToPassword(_id: ObjectID!): User
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
          // if the auth user is in the database and has no next_step instuctions, give them access to find any users
          accessRule: context.profile._id && !context.profile.next_step ? {} : undefined,
        }),
      userPublic: (_, args, context: Context) =>
        findDocAndPrune({
          model: 'User',
          _id: args._id,
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        }),
      userPublicBySlug: (_, args, context: Context) =>
        findDocAndPrune({
          model: 'User',
          _id: args.slug,
          by: 'slug',
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        }),
      users: (_, args, context: Context) =>
        findDocs({
          model: 'User',
          args,
          context,
          // if the auth user is in the database and has no next_step instuctions, give them access to find all users
          accessRule: context.profile._id && !context.profile.next_step ? {} : undefined,
        }),
      usersPublic: async (_, args, context: Context) =>
        findDocsAndPrune({
          model: 'User',
          args,
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        }),
      userActionAccess: (_, __, context: Context) => getCollectionActionAccess({ model: 'User', context }),
      userExists: async (_, args, context: Context) => {
        const findArgs = {
          model: 'User',
          _id: args.username,
          context,
          keep: PRUNED_USER_KEEP_FIELDS,
          fullAccess: true,
        };
        // find user by username or slug
        const user =
          ((await findDocAndPrune({ ...findArgs, by: 'username' })) as IUserDoc | undefined) ||
          ((await findDocAndPrune({ ...findArgs, by: 'slug' })) as IUserDoc | undefined);
        return { exists: !!user, doc: user || null, methods: user?.methods };
      },
      userMethods: async (_, args, context: Context) => {
        const findArgs = { model: 'User', _id: args.username, context, fullAccess: true };
        const user =
          ((await findDoc({ ...findArgs, by: 'username' })) as unknown as IUserDoc | undefined) ||
          ((await findDoc({ ...findArgs, by: 'slug' })) as unknown as IUserDoc | undefined);
        return user?.methods || [];
      },
    },
    Mutation: {
      userCreate: async (_, args, context: Context) => {
        // step 1: create temporary password
        const password = generator.generate({
          length: 24,
          numbers: true,
          symbols: true,
          excludeSimilarCharacters: true,
          exclude: '<>', // these cannot be sent via html
          strict: true,
        });

        // step 2: create the user document
        let user = (await createDoc({ model: 'User', args, context })) as IUser & PassportLocalDocument;

        // step 3: set the temporary password
        await user.setPassword(password);
        user.methods = ['local'];
        user = await user.save();

        // step 4: flag password as temporary (expires after 48 hours)
        const expiresAt = new Date().getTime() + 1000 * 60 * 60 * 48; // Unix milliseconds 48 hours from now
        user.flags = [`TEMPORARY_PASSWORD_${expiresAt}`];
        user = await user.save();

        // step 5: send email to new user
        const email = `
          <h1 style="font-size: 20px;">
            The Paladin Network
          </h1>
          <p>
            <a href="${context.profile.email}">${context.profile.name}</a> has added you to <i>The Paladin</i>'s instance of Cristata.
            <br />
            To finish activating your account, sign in with your temporary password at <a href="https://thepaladin.cristata.app/sign-in">https://thepaladin.cristata.app/sign-in</a>.
          </p>
          <p>
            <span>
              <b>Username: </b>
              ${user.username}
            </span>
            <br />
            <span>
              <b>Temporary password: </b>
              ${password}
            </span>
            </p>
          <p>
            You have 48 hours to sign in with this temporary password.
            <br />
            If you fail to sign in before the password expires, contact <a href="${context.profile.email}">${context.profile.name}</a> to receive another temporary password.
          </p>
        `;
        sendEmail(
          user.email,
          `Activate your Cristata account`,
          email,
          `The Paladin Network <noreply@thepaladin.news>`
        );

        // return the user
        return withPubSub('USER', 'CREATED', user.save());
      },
      userModify: (_, { _id, input }, context: Context) => {
        const isSelf = _id.toHexString() === context.profile._id;
        return withPubSub(
          'USER',
          'MODIFIED',
          modifyDoc({
            model: 'User',
            data: { ...input, _id },
            context,
            fullAccess: isSelf,
          })
        );
      },
      userHide: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', hideDoc({ model: 'User', args, context })),
      userLock: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', lockDoc({ model: 'User', args, context })),
      userWatch: async (_, args, context: Context) =>
        withPubSub('USER', 'MODIFIED', watchDoc({ model: 'User', args, context })),
      userDelete: async (_, args, context: Context) =>
        withPubSub('USER', 'DELETED', deleteDoc({ model: 'User', args, context })),
      userPasswordChange: async (_, { oldPassword, newPassword }, context: Context) => {
        const Model = mongoose.model<IUser & PassportLocalDocument>('User');
        const user = await Model.findById(context.profile._id);
        const changedUser = (await user.changePassword(oldPassword, newPassword)) as IUser &
          PassportLocalDocument;
        changedUser.flags = changedUser.flags.filter((flag) => !flag.includes('TEMPORARY_PASSWORD'));
        return changedUser.save();
      },
      userDeactivate: async (_, args, context: Context) =>
        withPubSub(
          'USER',
          'MODIFIED',
          (async () => {
            requireAuthentication(context);

            // set defaults
            if (args.deactivate === undefined) args.deactivate = true;

            // get the document
            const doc = await findDoc({ model: 'User', _id: args._id, context });

            // if the user cannot retire other users in the collection, return an error
            if (!canDo({ action: 'deactivate', model: 'User', context }))
              throw new ForbiddenError('you cannot deactivate users');

            // set relevant collection metadata
            doc.people.modified_by = [...new Set([...doc.people.modified_by, context.profile._id])];
            doc.people.last_modified_by = context.profile._id;
            doc.retired = args.deactivate;
            doc.history = [
              ...doc.history,
              {
                type: args.deactivate ? 'deactivated' : 'activated',
                user: context.profile._id,
                at: new Date().toISOString(),
              },
            ];

            // save the document
            return await doc.save();
          })()
        ),
      userResendInvite: async (_, args, context: Context) => {
        let user = (await findDoc({ model: 'User', _id: args._id, context })) as unknown as IUser &
          PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        if (!temporary)
          throw new ForbiddenError('you cannot resend an invite for a user who already has an account');

        // step 1: create temporary password
        const password = generator.generate({
          length: 24,
          numbers: true,
          symbols: true,
          excludeSimilarCharacters: true,
          exclude: '<>', // these cannot be sent via html
          strict: true,
        });

        // step 2: set the temporary password
        await user.setPassword(password);
        user = await user.save();

        // step 3: flag password as temporary (expires after 48 hours)
        const expiresAt = new Date().getTime() + 1000 * 60 * 60 * 48; // Unix milliseconds 48 hours from now
        user.flags = [`TEMPORARY_PASSWORD_${expiresAt}`];
        user = await user.save();

        // step 4: send email to reinvited user
        const email = `
            <h1 style="font-size: 20px;">
              The Paladin Network
            </h1>
            <p>
              <a href="${context.profile.email}">${context.profile.name}</a> has reinvited you to <i>The Paladin</i>'s instance of Cristata.
              <br />
              To finish activating your account, sign in with your temporary password at <a href="https://thepaladin.cristata.app/sign-in">https://thepaladin.cristata.app/sign-in</a>.
            </p>
            <p>
              <span>
                <b>Username: </b>
                ${user.username}
              </span>
              <br />
              <span>
                <b>Temporary password: </b>
                ${password}
              </span>
              </p>
            <p>
              You have 48 hours to sign in with this temporary password.
              <br />
              If you fail to sign in before the password expires, contact <a href="${context.profile.email}">${context.profile.name}</a> to receive another temporary password.
            </p>
          `;
        sendEmail(
          user.email,
          `Activate your Cristata account`,
          email,
          `The Paladin Network <noreply@thepaladin.news>`
        );

        // return the user
        return await user.save();
      },
      userMigrateToPassword: async (_, args, context: Context) => {
        let user = (await findDoc({ model: 'User', _id: args._id, context })) as unknown as IUser &
          PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        const isLocal = user.methods.includes('local');
        if (temporary || isLocal)
          throw new ForbiddenError('you cannot migrate a user who already has a local account');

        if (!user.email) throw new ForbiddenError('you cannot migrate a user without an email address');

        // step 0: create a username
        if (!user.username) {
          user.username = slugify(user.name || '', '.');
          user = await user.save();
        }

        // step 1: create temporary password
        const password = generator.generate({
          length: 24,
          numbers: true,
          symbols: true,
          excludeSimilarCharacters: true,
          exclude: '<>', // these cannot be sent via html
          strict: true,
        });

        // step 2: set the temporary password
        await user.setPassword(password);
        user.methods = [...(user.methods || []), 'local'];
        user = await user.save();

        // step 3: flag password as temporary (expires after 48 hours)
        const expiresAt = new Date().getTime() + 1000 * 60 * 60 * 48; // Unix milliseconds 48 hours from now
        user.flags = [`TEMPORARY_PASSWORD_${expiresAt}`];
        user = await user.save();

        // step 4: send email to reinvited user
        const email = `
            <h1 style="font-size: 20px;">
              The Paladin Network
            </h1>
            <p>
              <span style="font-size: 18px;">To finish migrating your account, <a href="${
                process.env.PASSPORT_REDIRECT
              }?ue=${encodeURIComponent(Buffer.from(user.username).toString('base64'))}&pe=${encodeURIComponent(
          Buffer.from(password).toString('base64')
        )}">click here</a>.</span>
              
            </p>
            <p>
              Alternatively, you may sign in with the following temporary credentials at <a href="${
                process.env.PASSPORT_REDIRECT
              }">${process.env.PASSPORT_REDIRECT}</a>:
              <br />
              <span>
                <b>Username: </b>
                ${user.username}
              </span>
              <br />
              <span>
                <b>Temporary password: </b>
                ${password}
              </span>
              </p>
            <p>
              You have 48 hours to sign in with this temporary password.
              <br />
              If you fail to sign in before the password expires, you will lose access to your account.
            </p>
          `;
        sendEmail(
          user.email,
          `Complete your Cristata account migration`,
          email,
          `The Paladin Network <noreply@thepaladin.news>`
        );

        // return the user
        return await user.save();
      },
    },
    User: {
      teams: async (_, args, context: Context) => {
        const _id = new mongoose.Types.ObjectId(args._id);
        const docs = await findDocs({
          model: 'Team',
          args: { filter: { $or: [{ organizers: _id }, { members: _id }] }, ...args },
          context,
        });
        return docs;
      },
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
    methods: { type: [String], default: [] },
    retired: { type: Boolean, default: false },
    flags: { type: [String], default: [] },
  }),
  permissions: (Users, Teams) => ({
    get: { teams: [Teams.ANY], users: [] },
    create: { teams: [Teams.ANY], users: [] },
    modify: { teams: [Teams.ADMIN, Teams.MANAGING_EDITOR], users: [] },
    hide: { teams: [Teams.ANY], users: [] },
    lock: { teams: [Teams.ADMIN], users: [] },
    watch: { teams: [Teams.ANY], users: [] },
    deactivate: { teams: [Teams.ADMIN, Teams.MANAGING_EDITOR], users: [] },
    delete: { teams: [Teams.ADMIN], users: [] },
  }),
};

type GitHubUserID = number;

interface IUser extends CollectionSchemaFields {
  name: string;
  username?: string; // from passpsort-local-mongoose
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
  methods?: string[];
  retired?: boolean;
  flags: string[];
}

interface IUserTimestamps {
  joined_at: string; // ISO string
  left_at: string; // ISO string
  last_login_at: string; // ISO string
}

interface IUserDoc extends IUser, mongoose.Document {}

export type { IUser, IUserDoc };
export { users, PRUNED_USER_KEEP_FIELDS };
