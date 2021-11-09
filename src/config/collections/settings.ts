import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import { createDoc, findDoc, findDocs, getCollectionActionAccess, modifyDoc, withPubSub } from './helpers';

const settings: Collection = {
  name: 'Settings',
  canPublish: false,
  withPermissions: false,
  typeDefs: gql`
    type Settings {
      name: String!
      setting: JSON!
    }

    input SettingsModifyInput {
      name: String
      setting: JSON
    }

    type Query {
      """
      Get a setting by id.
      """
      setting(_id: ObjectID!): Settings
      """
      Get a set of settings. If names is omitted, the API will return all settings.
      """
      settings(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Settings>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      settingActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new setting.
      """
      settingCreate(github_id: Int, name: String!): Settings
      """
      Modify an existing setting.
      """
      settingModify(_id: ObjectID!, input: SettingsModifyInput!): Settings
    }

    extend type Subscription {
      """
      Sends setting documents when they are created.
      """
      settingCreated(): Settings
      """
      Sends the updated setting document when it changes.
      If _id is omitted, the server will send changes for all settings.
      """
      settingModified(_id: ObjectID): Settings
    }
  `,
  resolvers: {
    Query: {
      setting: (_, args, context: Context) =>
        findDoc({
          model: 'Settings',
          _id: args._id,
          context,
          fullAccess: true,
        }),
      settings: (_, args, context: Context) => findDocs({ model: 'Settings', args, context }),
      settingActionAccess: (_, __, context: Context) =>
        getCollectionActionAccess({ model: 'Settings', context }),
    },
    Mutation: {
      settingCreate: async (_, args, context: Context) =>
        withPubSub('SETTING', 'CREATED', createDoc({ model: 'Settings', args, context })),
      settingModify: (_, { _id, input }, context: Context) =>
        withPubSub('SETTING', 'MODIFIED', modifyDoc({ model: 'Settings', data: { ...input, _id }, context })),
    },
    Subscription: {
      settingCreated: { subscribe: () => pubsub.asyncIterator(['SETTING_CREATED']) },
      settingModified: { subscribe: () => pubsub.asyncIterator(['SETTING_MODIFIED']) },
    },
  },
  schemaFields: () => ({
    name: { type: String, required: true },
    setting: {},
  }),
  permissions: (Users, Teams) => ({
    get: { teams: [Teams.ADMIN], users: [] },
    create: { teams: [Teams.ADMIN], users: [] },
    modify: { teams: [Teams.ADMIN], users: [] },
    hide: { teams: [], users: [] },
    lock: { teams: [], users: [] },
    watch: { teams: [], users: [] },
    delete: { teams: [], users: [] },
  }),
};

interface ISettings extends CollectionSchemaFields {
  name: string;
  setting: Record<string, unknown> & mongoose.Document;
}

interface ISettingsDoc extends ISettings, mongoose.Document {}

export type { ISettings, ISettingsDoc };
export { settings };
