import { Context, gql } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import { createDoc, findDoc, findDocs, getCollectionActionAccess, modifyDoc } from './helpers';

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
      settingCreate: (_, args, context: Context) => createDoc({ model: 'Settings', args, context }),
      settingModify: (_, { _id, input }, context: Context) =>
        modifyDoc({ model: 'Settings', data: { ...input, _id }, context }),
    },
  },
  schemaFields: () => ({
    original_url: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
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
  setting: JSON;
}

interface ISettingsDoc extends ISettings, mongoose.Document {}

export type { ISettings, ISettingsDoc };
export { settings };
