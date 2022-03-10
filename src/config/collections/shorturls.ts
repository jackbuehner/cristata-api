import { Context, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { customAlphabet } from 'nanoid';
import { UserInputError } from 'apollo-server-errors';
import { TeamsType, UsersType } from '../../types/config';

const shorturls = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const {
    createDoc,
    deleteDoc,
    findDoc,
    findDocs,
    genSchema,
    getCollectionActionAccess,
    hideDoc,
    lockDoc,
    modifyDoc,
    watchDoc,
    withPubSub,
  } = helpers;

  const name = 'ShortURL';
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
      original_url: { type: String, required: true, modifiable: true },
      code: {
        type: String,
        required: true,
        modifiable: true,
        unique: true,
        default: { code: 'alphanumeric', length: 7 },
      },
      domain: { type: String, required: true, modifiable: true },
    },
    by: { one: ['code', mongoose.Schema.Types.String], many: ['_id', mongoose.Schema.Types.ObjectId] },
  });

  return {
    name,
    canPublish,
    withPermissions,
    typeDefs,
    resolvers: {
      Query: {
        shorturl: (_, args, context: Context) =>
          findDoc({
            model: 'ShortURL',
            by: 'code',
            _id: args.code,
            context,
            fullAccess: true,
          }),
        shorturls: (_, args, context: Context) => findDocs({ model: 'ShortURL', args, context }),
        shorturlActionAccess: (_, __, context: Context) =>
          getCollectionActionAccess({ model: 'ShortURL', context }),
      },
      Mutation: {
        shorturlCreate: async (_, args, context: Context) => {
          // return error if shorturl code is not alphanumeric
          if (args.code && !args.code.match(/^[a-z0-9]+$/i))
            throw new UserInputError('shorturl code must be alphanumeric');

          // return error if code is not unique
          const codeExists = !!(await findDoc({
            model: 'ShortURL',
            by: 'code',
            _id: args.code,
            context,
            fullAccess: true,
          }));
          if (codeExists) throw new UserInputError('shorturl code must be unique');

          // if no code is provided, generate an alphanumeric code
          const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7);
          if (!args.code) args.code = generateCode();

          // return the new shorturl doc
          return withPubSub('SHORTURL', 'CREATED', createDoc({ model: 'ShortURL', args, context }));
        },
        shorturlModify: (_, { _id, input }, context: Context) =>
          withPubSub(
            'SHORTURL',
            'MODIFIED',
            modifyDoc({ model: 'ShortURL', data: { ...input, _id }, context })
          ),
        shorturlHide: async (_, args, context: Context) =>
          withPubSub('SHORTURL', 'MODIFIED', hideDoc({ model: 'ShortURL', args, context })),
        shorturlLock: async (_, args, context: Context) =>
          withPubSub('SHORTURL', 'MODIFIED', lockDoc({ model: 'ShortURL', args, context })),
        shorturlWatch: async (_, args, context: Context) =>
          withPubSub('SHORTURL', 'MODIFIED', watchDoc({ model: 'ShortURL', args, context })),
        shorturlDelete: async (_, args, context: Context) =>
          withPubSub('SHORTURL', 'DELETED', deleteDoc({ model: 'ShortURL', args, context })),
      },
      Subscription: {
        shorturlCreated: { subscribe: () => pubsub.asyncIterator(['SHORTURL_CREATED']) },
        shorturlModified: { subscribe: () => pubsub.asyncIterator(['SHORTURL_MODIFIED']) },
        shorturlDeleted: { subscribe: () => pubsub.asyncIterator(['SHORTURL_DELETED']) },
      },
    },
    schemaFields,
    actionAccess: () => ({
      get: { teams: [Teams.ANY], users: [] },
      create: { teams: [Teams.SHORTURL], users: [] },
      modify: { teams: [Teams.SHORTURL], users: [] },
      hide: { teams: [Teams.SHORTURL], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    }),
  };
};

interface IShortURL extends CollectionSchemaFields {
  original_url: string;
  code: string;
  domain: string;
}

interface IShortURLDoc extends IShortURL, mongoose.Document {}

export type { IShortURL, IShortURLDoc };
export { shorturls };
