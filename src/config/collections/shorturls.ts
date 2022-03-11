import { Context } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { customAlphabet } from 'nanoid';
import { UserInputError } from 'apollo-server-errors';
import { TeamsType, UsersType } from '../../types/config';
import { merge } from 'merge-anything';

const shorturls = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'ShortURL',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      original_url: { type: String, required: true, modifiable: true },
      code: {
        type: String,
        required: true,
        modifiable: true,
        unique: true,
        default: { code: 'alphanumeric', length: 7 },
        //TODO: add regex input rules
      },
      domain: { type: String, required: true, modifiable: true },
    },
    by: { one: ['code', mongoose.Schema.Types.String], many: ['_id', mongoose.Schema.Types.ObjectId] },
    Users,
    Teams,
    helpers,
    actionAccess: () => ({
      get: { teams: [Teams.ANY], users: [] },
      create: { teams: [Teams.SHORTURL], users: [] },
      modify: { teams: [Teams.SHORTURL], users: [] },
      hide: { teams: [Teams.SHORTURL], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    }),
  });

  collection.resolvers = merge(collection.resolvers, {
    Mutation: {
      shorturlCreate: async (_, args, context: Context) => {
        // TODO: add regex input rule to schemaDef so that this resolver can be replaced by the default one
        // return error if shorturl code is not alphanumeric
        if (args.code && !args.code.match(/^[a-z0-9]+$/i))
          throw new UserInputError('shorturl code must be alphanumeric');

        // !: mongoose checks this automatically
        // return error if code is not unique
        const codeExists = !!(await helpers.findDoc({
          model: 'ShortURL',
          by: 'code',
          _id: args.code,
          context,
          fullAccess: true,
        }));
        if (codeExists) throw new UserInputError('shorturl code must be unique');

        // !: mongoose does this automatically (default: { code: 'alphanumeric', length: 7 })
        // if no code is provided, generate an alphanumeric code
        const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7);
        if (!args.code) args.code = generateCode();

        // return the new shorturl doc
        return helpers.withPubSub(
          'SHORTURL',
          'CREATED',
          helpers.createDoc({ model: 'ShortURL', args, context })
        );
      },
    },
  });

  return collection;
};

interface IShortURL extends CollectionSchemaFields {
  original_url: string;
  code: string;
  domain: string;
}

interface IShortURLDoc extends IShortURL, mongoose.Document {}

export type { IShortURL, IShortURLDoc };
export { shorturls };
