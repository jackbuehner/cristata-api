/* eslint-disable @typescript-eslint/no-explicit-any */
import { deconstructSchema, isTypeTuple } from '@jackbuehner/cristata-generator-schema';
import userCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/User';
import { getPasswordStatus, notEmpty, sendEmail, slugify } from '@jackbuehner/cristata-utils';
import { ApolloError } from 'apollo-server-core';
import { ForbiddenError } from 'apollo-server-errors';
import generator from 'generate-password';
import { merge } from 'merge-anything';
import mongoose, { PassportLocalDocument } from 'mongoose';
import helpers, { genCollection } from '../graphql/helpers';
import { Context } from '../graphql/server';
import { Collection } from '../types/config';
import { CollectionSchemaFields, GitHubTeamNodeID } from './helpers/constructBasicSchemaFields';
import { TenantDB } from './TenantDB';

const users = (tenant: string): Collection => {
  const { canDo, createDoc, findDoc, findDocs, gql, modifyDoc, requireAuthentication } = helpers;

  const collection = genCollection(
    {
      ...userCollection,
      actionAccess: {
        get: { teams: [0], users: [] },
        create: { teams: [0], users: [] },
        modify: { teams: ['admin', 'managing-editors'], users: [] },
        hide: { teams: [0], users: [] },
        lock: { teams: ['admin'], users: [] },
        watch: { teams: [0], users: [] },
        archive: { teams: [], users: [] },
        deactivate: { teams: ['admin', 'managing-editors'], users: [] },
        delete: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

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

    type UserReference {
      _id: String!
      count: Int!
      docs: [UserReferenceDoc!]!
    }

    type UserReferenceDoc {
      _id: ObjectID!
      name: String
      url: String
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

      """
      Returns a list of documents in collections that reference this user
      """
      userReferences(_id: ObjectID, collections: [String!], exclude: [String!]): [UserReference!]!
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
      user: (_: never, args: { _id: any }, context: Context) =>
        findDoc({
          model: 'User',
          _id: args._id || new mongoose.Types.ObjectId(context.profile?._id),
          context,
        }),

      userExists: async (_: never, args: any, context: Context) => {
        const findArgs = {
          model: 'User',
          _id: args.username,
          context,
          fullAccess: true,
        };
        // find user by username or slug
        const user =
          ((await findDoc({ ...findArgs, by: 'username' })) as unknown as IUser | undefined) ||
          ((await findDoc({ ...findArgs, by: 'slug' })) as unknown as IUser | undefined);
        return { exists: !!user, doc: user || null, methods: user?.methods };
      },

      userMethods: async (_: never, args: any, context: Context) => {
        const findArgs = { model: 'User', _id: args.username, context, fullAccess: true };
        const user =
          ((await findDoc({ ...findArgs, by: 'username' })) as unknown as IUser | undefined) ||
          ((await findDoc({ ...findArgs, by: 'slug' })) as unknown as IUser | undefined);
        return user?.methods || [];
      },

      userReferences: async (
        _: never,
        {
          _id,
          collections,
          exclude,
        }: { _id: mongoose.Types.ObjectId; collections?: string[]; exclude?: string[] },
        context: Context
      ) => {
        return await getUserReferences({ _id, collections, exclude, context });
      },
    },
    Mutation: {
      userCreate: async (_: never, args: any, context: Context) => {
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
        return setTemporaryPassword(user, 'invite', context, args.retired === true);
      },
      userModify: (_: never, { _id, input }: any, context: Context) => {
        const isSelf = _id.toHexString() === context.profile?._id.toHexString();
        return modifyDoc({
          model: 'User',
          data: { ...input, _id },
          _id,
          context,
          fullAccess: isSelf,
        });
      },
      userPasswordChange: async (_: never, { oldPassword, newPassword }: any, context: Context) => {
        const tenantDB = new TenantDB(context.tenant, context.config.collections);
        await tenantDB.connect();
        const Model = await tenantDB.model<IUser & PassportLocalDocument>('User');
        const user = await Model?.findById(context.profile?._id);
        const changedUser = (await user?.changePassword(oldPassword, newPassword)) as
          | (IUser & PassportLocalDocument)
          | undefined;
        if (changedUser) {
          changedUser.flags = changedUser.flags.filter((flag) => !flag.includes('TEMPORARY_PASSWORD'));
          return changedUser.save();
        }
      },
      userDeactivate: async (_: never, args: { deactivate: unknown; _id: any }, context: Context) => {
        requireAuthentication(context);

        // set defaults
        if (args.deactivate === undefined) args.deactivate = true;

        // get the document
        const doc = await findDoc({ model: 'User', _id: args._id, context, lean: false });
        if (!doc) {
          throw new ApolloError(
            'the user you are trying to deactivate does not exist or you do not have access',
            'DOCUMENT_NOT_FOUND'
          );
        }

        // if the user cannot retire other users in the collection, return an error
        if (!(await canDo({ action: 'deactivate', model: 'User', context })))
          throw new ForbiddenError('you cannot deactivate users');

        // set relevant collection metadata
        if (context.profile) {
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
        }

        // save the document
        return await doc.save();
      },
      userResendInvite: async (_: never, args: any, context: Context) => {
        const user = (await findDoc({
          model: 'User',
          _id: args._id,
          context,
          lean: false,
        })) as unknown as IUserDoc & PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        if (!temporary)
          throw new ForbiddenError('you cannot resend an invite for a user who already has an account');

        return await setTemporaryPassword(user, 'reinvite', context);
      },
      userMigrateToPassword: async (_: never, args: any, context: Context) => {
        const user = (await findDoc({
          model: 'User',
          _id: args._id,
          context,
          lean: false,
        })) as unknown as IUserDoc & PassportLocalDocument;
        const { temporary } = getPasswordStatus(user.flags);
        const isLocal = user.methods?.includes('local');
        if (temporary || isLocal)
          throw new ForbiddenError('you cannot migrate a user who already has a local account');

        // create a temp password, alert the user via email, and return the user

        return await setTemporaryPassword(user, 'migrate', context);
      },
    },
    User: {
      teams: async (_: never, args: any, context: Context) => {
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
>(
  user: T,
  reason: 'reinvite' | 'reset the password of' | 'invite' | 'migrate',
  context: Context,
  skipEmail?: boolean
): Promise<T> {
  if (!user.email) throw new ForbiddenError(`you cannot ${reason} a user without an email address`);

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
  const appSignInPage = process.env.AUTH_APP_URL + '/' + context.profile?.tenant;
  const encodedUsername = encodeURIComponent(Buffer.from(user.username || '').toString('base64'));
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
          ? `<a href="${context.profile?.email}">${context.profile?.name}</a> has added you to ${context.config.tenantDisplayName}'s instance of Cristata.`
          : reason === 'reinvite'
          ? `<a href="${context.profile?.email}">${context.profile?.name}</a> has reinvited you to ${context.config.tenantDisplayName}'s instance of Cristata.`
          : reason === 'reset the password of'
          ? `<a href="${context.profile?.email}">${context.profile?.name}</a> has reset your password for ${context.config.tenantDisplayName}'s instance of Cristata.`
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

  const emailConfig = {
    defaultSender: context.config.defaultSender,
    tenantDisplayName: context.config.tenantDisplayName,
    secrets: context.config.secrets.aws,
  };

  if (user.email && skipEmail !== true) {
    sendEmail(
      emailConfig,
      user.email,
      subject,
      email,
      `${context.config.tenantDisplayName} <noreply@thepaladin.news>`
    );
  }

  return user;
}

/**
 * Gets a list of doc _ids in each collection where the user
 * with the provided _id is referenced.
 *
 * Use this function to determine if a user can be deleted without
 * damaging existing references.
 */
async function getUserReferences({
  _id,
  collections,
  exclude,
  context,
}: {
  _id: mongoose.Types.ObjectId;
  collections?: string[];
  exclude?: string[];
  context: Context;
}) {
  let collectionNames = context.config.collections.map((col) => col.name);
  if (collections) collectionNames = collectionNames.filter((name) => collections.includes(name));
  else if (exclude) collectionNames = collectionNames.filter((name) => !exclude.includes(name));

  const collectionNamesPluralized = collectionNames
    .map((name) => mongoose.pluralize()?.(name))
    .filter(notEmpty);

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();
  const Model = await tenantDB.model(collectionNames[0]);

  const peopleFields = ([] as string[]).concat(
    ...collectionNames.map((name): string[] => {
      const collection = context.config.collections.find((col) => col.name === name);
      const deconstructedSchema = deconstructSchema(collection?.schemaDef || {});

      // return an array of keys that are reference fields to User
      return deconstructedSchema
        .filter(([, def]) => {
          return isTypeTuple(def.type) && def.type[0].includes('User');
        })
        .map(([key]) => key);
    })
  );

  const pipeline: mongoose.PipelineStage[] = [
    { $addFields: { collection: collectionNamesPluralized[0] } },
    ...collectionNamesPluralized.map((collectionName) => ({
      $unionWith: {
        coll: collectionName,
        pipeline: [{ $addFields: { collection: collectionName } }],
      },
    })),
    {
      $match: {
        $or: [
          { 'people.created_by': _id },
          { 'people.last_modified_by': _id },
          { 'people.modified_by': _id },
          { 'people.watching': _id },
          { 'people.published_by': _id },
          ...peopleFields.map((fieldName) => {
            return { [fieldName]: _id };
          }),
        ],
      },
    },
    {
      $project: {
        name: 1,
        collection: 1,
        // use empty array if field does not exist
        'permissions.users': {
          $ifNull: ['$permissions.users', '$permissions.users', [context.profile?._id]],
        }, // put _id inside to doc will appear for this user (missing permissions object means there are no permissions)
        'permissions.teams': { $ifNull: ['$permissions.teams', '$permissions.teams', []] },
      },
    },
    {
      $group: {
        _id: '$collection' as any,
        count: {
          $sum: 1,
        },
        docs: {
          $push: context.profile?.teams.includes('000000000000000000000001')
            ? {
                _id: '$_id',
                name: '$name',
                url: {
                  $concat: [
                    'https://cristata.app/',
                    context.tenant,
                    '/cms/collection/',
                    '$collection',
                    '/',
                    { $toString: '$_id' },
                  ],
                },
              }
            : {
                $cond: [
                  {
                    $or: [
                      { $in: [context.profile?._id, '$permissions.users'] },
                      { $in: [context.profile?._id, '$permissions.teams'] },
                    ],
                  },
                  {
                    _id: '$_id',
                    name: '$name',
                    url: {
                      $concat: [
                        'https://cristata.app/',
                        context.tenant,
                        '/cms/collection/',
                        '$collection',
                        '/',
                        { $toString: '$_id' },
                      ],
                    },
                  },
                  '$$REMOVE',
                ],
              },
        },
      },
    },
  ];

  if (Model) {
    return Model?.aggregate(pipeline);
  }

  return [];
}

type GitHubUserID = number;

interface IUser extends CollectionSchemaFields {
  name: string;
  username: string; // from passpsort-local-mongoose
  slug: string;
  phone?: number;
  email?: string;
  twitter?: string;
  biography?: string;
  current_title?: string;
  timestamps: IUserTimestamps & CollectionSchemaFields['timestamps'];
  photo?: string; // url to photo
  versions: IUser[]; // store previous versions of the user profile (only via v2 api)
  last_magic_code?: string;
  github_id: GitHubUserID;
  teams: GitHubTeamNodeID[];
  group?: number;
  methods?: string[];
  retired?: boolean;
  flags: string[];
  constantcontact?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

interface IUserTimestamps {
  joined_at: string; // ISO string
  left_at: string; // ISO string
  last_login_at: string; // ISO string
  last_active_at: string; // ISO string
}

interface IUserDoc extends IUser, mongoose.Document {}

export type { IUser, IUserDoc };
export { users };
