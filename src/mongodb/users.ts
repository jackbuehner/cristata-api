import { ForbiddenError } from 'apollo-server-errors';
import generator from 'generate-password';
import { merge } from 'merge-anything';
import mongoose, { PassportLocalDocument } from 'mongoose';
import helpers, { genCollection } from '../api/v3/helpers';
import { Context } from '../apollo';
import { CollectionSchemaFields, GitHubTeamNodeID } from '../mongodb/db';
import { Collection } from '../types/config';
import { getPasswordStatus } from '../utils/getPasswordStatus';
import { sendEmail } from '../utils/sendEmail';
import { slugify } from '../utils/slugify';

const users = (): Collection => {
  const { canDo, createDoc, findDoc, findDocs, gql, modifyDoc, requireAuthentication, withPubSub } = helpers;

  const collection = genCollection({
    name: 'User',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: { filter: {} },
    schemaDef: {
      name: { type: 'String', required: true, modifiable: true, public: true, default: 'New User' },
      slug: { type: 'String', required: true, modifiable: true, public: true, default: 'new-user' },
      phone: { type: 'Float', modifiable: true },
      email: { type: 'String', modifiable: true, public: true },
      twitter: { type: 'String', modifiable: true, public: true },
      biography: { type: 'String', modifiable: true, public: true },
      current_title: { type: 'String', modifiable: true, public: true },
      timestamps: {
        joined_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
        left_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
        last_login_at: { type: 'Date', required: true, default: new Date().toISOString() },
      },
      photo: { type: 'String', modifiable: true, public: true },
      github_id: { type: 'Number', public: true },
      group: { type: 'Float', modifiable: true, public: true, default: '5.10' },
      methods: { type: ['String'], default: [] },
      retired: { type: 'Boolean', default: false },
      flags: { type: ['String'], required: true, default: [] },
    },
    actionAccess: {
      get: { teams: [0], users: [] },
      create: { teams: [0], users: [] },
      modify: { teams: ['admin', 'managing-editors'], users: [] },
      hide: { teams: [0], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      deactivate: { teams: ['admin', 'managing-editors'], users: [] },
      delete: { teams: ['admin'], users: [] },
    },
    options: {
      disableFindOneQuery: true,
    },
  });

  collection.typeDefs += gql`
    extend type User {
      username: String
      teams(_id: ObjectID!, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Team>
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
  `;

  collection.resolvers = merge(collection.resolvers, {
    Query: {
      user: (_, args, context: Context) =>
        findDoc({
          model: 'User',
          _id: args._id || new mongoose.Types.ObjectId(context.profile._id),
          context,
        }),

      userExists: async (_, args, context: Context) => {
        const findArgs = {
          model: 'User',
          _id: args.username,
          context,
          fullAccess: true,
        };
        // find user by username or slug
        const user =
          ((await findDoc({ ...findArgs, by: 'username' })) as unknown as IUserDoc | undefined) ||
          ((await findDoc({ ...findArgs, by: 'slug' })) as unknown as IUserDoc | undefined);
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
        // check that slug is unique, and replace slug and username if it is not unique
        let exists = !!(await findDoc({ model: 'User', by: 'slug', _id: args.slug, context }));
        let number = 0;
        const baseSlug: string = args.slug;
        const baseUsername: string = args.username;
        while (exists) {
          number += 1;
          args.slug = baseSlug + number;
          args.username = baseUsername + number;
          exists = !!(await findDoc({ model: 'User', by: 'slug', _id: args.slug, context }));
        }

        // create the user document
        const user = (await createDoc({ model: 'User', args, context })) as IUser & PassportLocalDocument;

        // return the user
        return withPubSub('USER', 'CREATED', setTemporaryPassword(user, 'reinvite', context));
      },
      userModify: (_, { _id, input }, context: Context) => {
        const isSelf = _id.toHexString() === context.profile._id.toHexString();
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
            if (!(await canDo({ action: 'deactivate', model: 'User', context })))
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
        const user = (await findDoc({ model: 'User', _id: args._id, context })) as unknown as IUser &
          PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        if (!temporary)
          throw new ForbiddenError('you cannot resend an invite for a user who already has an account');

        return await setTemporaryPassword(user, 'reinvite', context);
      },
      userMigrateToPassword: async (_, args, context: Context) => {
        const user = (await findDoc({ model: 'User', _id: args._id, context })) as unknown as IUser &
          PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        const isLocal = user.methods.includes('local');
        if (temporary || isLocal)
          throw new ForbiddenError('you cannot migrate a user who already has a local account');

        // create a temp password, alert the user via email, and return the user
        return await setTemporaryPassword(user, 'migrate', context);
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
  });

  return collection;
};

async function setTemporaryPassword<
  T extends mongoose.PassportLocalDocument & {
    methods?: string[];
    flags?: string[];
    username?: string;
    email?: string;
    name?: string;
  }
>(user: T, reason: 'reinvite' | 'reset the password of' | 'invite' | 'migrate', context: Context): Promise<T> {
  if (!user.email) throw new ForbiddenError('you cannot ${reason} a user without an email address');

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

  // step 4: send an email alert
  const appSignInPage = process.env.APP_URL + '/sign-in';
  const encodedUsername = encodeURIComponent(Buffer.from(user.username).toString('base64'));
  const encodedPassword = encodeURIComponent(Buffer.from(password).toString('base64'));
  const action =
    reason === 'invite'
      ? `activating`
      : reason === 'reinvite'
      ? `activating`
      : reason === 'reset the password of'
      ? `recovering`
      : reason === 'migrate'
      ? `migrating`
      : ``;

  const email = `
    <h1 style="font-size: 20px;">
      The Paladin Network
    </h1>
    <p>
      ${
        reason === 'invite'
          ? `<a href="${context.profile.email}">${context.profile.name}</a> has added you to ${context.config.tenantDisplayName}'s instance of Cristata.`
          : reason === 'reinvite'
          ? `<a href="${context.profile.email}">${context.profile.name}</a> has reinvited you to ${context.config.tenantDisplayName}'s instance of Cristata.`
          : reason === 'reset the password of'
          ? `<a href="${context.profile.email}">${context.profile.name}</a> has reset your password for ${context.config.tenantDisplayName}'s instance of Cristata.`
          : ``
      }
      <span style="font-size: 18px;">
        To finish ${action} your account,
        <a href="${appSignInPage}?ue=${encodedUsername}&pe=${encodedPassword}">click here</a>
        .
      </span>
    </p>
    <p>
      Alternatively, you may sign in with the following temporary credentials at
      <a href="${appSignInPage}">${appSignInPage}</a>:
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

  const subject =
    reason === 'invite'
      ? `Activate your Cristata account`
      : reason === 'reinvite'
      ? `Activate your Cristata account`
      : reason === 'reset the password of'
      ? `Set a new Cristata account password`
      : reason === 'migrate'
      ? `Finish migrating your Cristata account`
      : ``;

  sendEmail(
    context.config,
    user.email,
    subject,
    email,
    `${context.config.tenantDisplayName} <noreply@thepaladin.news>`
  );

  return user;
}

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
export { users };
