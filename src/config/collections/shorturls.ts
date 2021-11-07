import { Context, gql } from '../../apollo';
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
      Get a shorturl by _id.
      """
      shorturl(_id: ObjectID!): ShortURL
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
      shorturlCreate(original_url: String!, code: String!, domain: Float!): ShortURL
      """
      Modify an existing shorturl.
      """
      shorturlModify(_id: ObjectID!, input: ShortURLModifyInput!): ShortURL
      """
      Toggle whether the hidden property is set to true for an existing shorturl.
      This mutation sets hidden: true by default.
      Hidden shorturls should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      shorturlHide(_id: ObjectID!, hide: Boolean): ShortURL
      """
      Toggle whether the locked property is set to true for an existing shorturl.
      This mutation sets locked: true by default.
      Locked shorturls should only be editable by the server and by admins.
      """
      shorturlLock(_id: ObjectID!, lock: Boolean): ShortURL
      """
      Add a watcher to a shorturl.
      This mutation adds the watcher by default.
      This mutation will use the signed in shorturl if watcher is not defined.
      """
      shorturlWatch(_id: ObjectID!, watcher: Int, watch: Boolean): ShortURL
      """
      Deletes a shorturl account.
      """
      shorturlDelete(_id: ObjectID!): Void
    }
  `,
  resolvers: {
    Query: {
      shorturl: (_, args, context: Context) =>
        findDoc({
          model: 'ShortURL',
          _id: args._id,
          context,
          fullAccess: true,
        }),
      shorturls: (_, args, context: Context) => findDocs({ model: 'ShortURL', args, context }),
      shorturlActionAccess: (_, __, context: Context) =>
        getCollectionActionAccess({ model: 'ShortURL', context }),
    },
    Mutation: {
      shorturlCreate: (_, args, context: Context) => createDoc({ model: 'ShortURL', args, context }),
      shorturlModify: (_, { _id, input }, context: Context) =>
        modifyDoc({ model: 'ShortURL', data: { ...input, _id }, context }),
      shorturlHide: (_, args, context: Context) => hideDoc({ model: 'ShortURL', args, context }),
      shorturlLock: (_, args, context: Context) => lockDoc({ model: 'ShortURL', args, context }),
      shorturlWatch: (_, args, context: Context) => watchDoc({ model: 'ShortURL', args, context }),
      shorturlDelete: (_, args, context: Context) => deleteDoc({ model: 'ShortURL', args, context }),
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
