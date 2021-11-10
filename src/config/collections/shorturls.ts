import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import {
  createDoc,
  deleteDoc,
  findDoc,
  findDocs,
  getCollectionActionAccess,
  hideDoc,
  lockDoc,
  modifyDoc,
  watchDoc,
  withPubSub,
} from './helpers';

const shorturls: Collection = {
  name: 'ShortURL',
  canPublish: false,
  withPermissions: false,
  typeDefs: gql`
    type ShortURL inherits Collection {
      original_url: String!
      code: String!
      domain: String!
    }

    input ShortURLModifyInput {
      original_url: String
      code: String
      domain: String
    }

    type Query {
      """
      Get a shorturl by code.
      """
      shorturl(code: String!): ShortURL
      """
      Get a set of shorturls. If _ids is omitted, the API will return all shorturls.
      """
      shorturls(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<ShortURL>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      shorturlActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new shorturl.
      """
      shorturlCreate(original_url: String!, code: String!, domain: String!): ShortURL
      """
      Modify an existing shorturl.
      """
      shorturlModify(code: String!, input: ShortURLModifyInput!): ShortURL
      """
      Toggle whether the hidden property is set to true for an existing shorturl.
      This mutation sets hidden: true by default.
      Hidden shorturls should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      shorturlHide(code: String!, hide: Boolean): ShortURL
      """
      Toggle whether the locked property is set to true for an existing shorturl.
      This mutation sets locked: true by default.
      Locked shorturls should only be editable by the server and by admins.
      """
      shorturlLock(code: String!, lock: Boolean): ShortURL
      """
      Add a watcher to a shorturl.
      This mutation adds the watcher by default.
      This mutation will use the signed in shorturl if watcher is not defined.
      """
      shorturlWatch(code: String!, watcher: Int, watch: Boolean): ShortURL
      """
      Deletes a shorturl account.
      """
      shorturlDelete(code: String!): Void
    }

    extend type Subscription {
      """
      Sends shorturl documents when they are created.
      """
      shorturlCreated(): ShortURL
      """
      Sends the updated shorturl document when it changes.
      If _id is omitted, the server will send changes for all shorturls.
      """
      shorturlModified(code: String): ShortURL
      """
      Sends shorturl _id when it is deleted.
      If _id is omitted, the server will send _ids for all deleted shorturls.
      """
      shorturlDeleted(code: String): ShortURL
    }
  `,
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
      shorturlCreate: async (_, args, context: Context) =>
        withPubSub('SHORTURL', 'CREATED', createDoc({ model: 'ShortURL', args, context })),
      shorturlModify: (_, { _id, input }, context: Context) =>
        withPubSub('SHORTURL', 'MODIFIED', modifyDoc({ model: 'ShortURL', data: { ...input, _id }, context })),
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
  schemaFields: () => ({
    original_url: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
  }),
  permissions: (Users, Teams) => ({
    get: { teams: [Teams.ANY], users: [] },
    create: { teams: [Teams.SHORTURL], users: [] },
    modify: { teams: [Teams.SHORTURL], users: [] },
    hide: { teams: [Teams.SHORTURL], users: [] },
    lock: { teams: [Teams.ADMIN], users: [] },
    watch: { teams: [Teams.ANY], users: [] },
    delete: { teams: [Teams.ADMIN], users: [] },
  }),
};

interface IShortURL extends CollectionSchemaFields {
  original_url: string;
  code: string;
  domain: string;
  hidden: boolean;
  name: string;
  slug: string;
}

interface IShortURLDoc extends IShortURL, mongoose.Document {}

export type { IShortURL, IShortURLDoc };
export { shorturls };
