import { Context, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { merge } from 'merge-anything';
import { UsersType, TeamsType } from '../../types/config';

const settings = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const { canDo, findDoc, findDocs, getCollectionActionAccess, gql, requireAuthentication, withPubSub } =
    helpers;

  const collection = helpers.generators.genCollection({
    name: 'Settings',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: String, required: true, modifiable: false, unique: true },
      setting: { type: JSON, required: true, modifiable: true, strict: false },
    },
    Users,
    Teams,
    helpers,
    actionAccess: () => ({
      get: { teams: [Teams.ADMIN], users: [] },
      create: { teams: [Teams.ADMIN], users: [] },
      modify: { teams: [Teams.ADMIN], users: [] },
      hide: { teams: [], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: [], users: [] },
    }),
  });

  return {
    ...collection,
    typeDefs: gql`
      type Settings {
        _id: ObjectID!
        name: String!
        setting: JSON!
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
        settingCreate(name: String!): Settings
        """
        Modify an existing setting.
        """
        settingModify(_id: ObjectID!, input: JSON!): Settings
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
          withPubSub(
            'SETTING',
            'CREATED',
            (async () => {
              // require authentication and authorization
              requireAuthentication(context);
              if (!canDo({ model: 'Settings', action: 'create', context })) {
                throw new ForbiddenError('you cannot create documents in this collection');
              }

              // create the new doc with the provided data and the schema defaults
              const newDoc = new (mongoose.model('Settings'))(args);

              // save and return the new doc
              return await newDoc.save();
            })()
          ),
        settingModify: (_, { _id, input }, context: Context) =>
          withPubSub(
            'SETTING',
            'MODIFIED',
            (async () => {
              // require authentication and authorization
              requireAuthentication(context);
              if (!canDo({ model: 'Settings', action: 'modify', context })) {
                throw new ForbiddenError('you cannot modify documents in this collection');
              }

              // if the current document does not exist OR the user does not have access, throw an error
              const currentDoc = await findDoc({ model: 'Settings', _id, context });
              if (!currentDoc)
                throw new ApolloError(
                  'the document you are trying to modify does not exist or you do not have access',
                  'DOCUMENT_NOT_FOUND'
                );

              // merge the new settings object into the old settings object
              const setting = merge(currentDoc.setting, input.setting);

              // attempt to patch the document
              return await mongoose
                .model('Settings')
                .findByIdAndUpdate(_id, { $set: { setting } }, { returnOriginal: false });
            })()
          ),
      },
      Subscription: {
        settingCreated: { subscribe: () => pubsub.asyncIterator(['SETTING_CREATED']) },
        settingModified: { subscribe: () => pubsub.asyncIterator(['SETTING_MODIFIED']) },
      },
    },
    actionAccess: () => ({
      get: { teams: [Teams.ADMIN], users: [] },
      create: { teams: [Teams.ADMIN], users: [] },
      modify: { teams: [Teams.ADMIN], users: [] },
      hide: { teams: [], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: [], users: [] },
    }),
  };
};

interface ISettings extends CollectionSchemaFields {
  name: string;
  setting: Record<string, unknown> & mongoose.Document;
}

interface ISettingsDoc extends ISettings, mongoose.Document {}

export type { ISettings, ISettingsDoc };
export { settings };
