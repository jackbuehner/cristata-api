import { collectionPeopleResolvers, Context, pubsub } from '../../apollo';
import { Collection, Teams } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields, WithPermissionsCollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';

const photos = (helpers: Helpers): Collection => {
  const {
    createDoc,
    deleteDoc,
    findDoc,
    findDocs,
    getCollectionActionAccess,
    getUsers,
    gql,
    hideDoc,
    lockDoc,
    modifyDoc,
    publishDoc,
    watchDoc,
    withPubSub,
  } = helpers;

  return {
    name: 'Photo',
    canPublish: false,
    withPermissions: true,
    typeDefs: gql`
      type Photo inherits Collection, WithPermissions {
        name: String!
        tags: [String]
        file_type: String
        photo_url: String
        dimensions: PhotoDimensions
        people: PhotoPeople
        legacy_caption: String
        legacy_thumbnail_id: String
        size: Int
      }
  
      type PhotoDimensions {
        x: Int
        y: Int
      }
  
      type PhotoPeople inherits CollectionPeople {
        photo_created_by: String
        uploaded_by: User
      }
  
      input PhotoModifyInput inherits WithPermissionsInput {
        name: String
        tags: [String]
        file_type: String
        photo_url: String
        dimensions: PhotoModifyInputDimensions
        people: PhotoModifyInputPeople
        size: Int
      }
  
      input PhotoModifyInputDimensions {
        x: Int
        y: Int
      }
  
      input PhotoModifyInputPeople {
        photo_created_by: String
        uploaded_by: ObjectID
      }
  
      type Query {
        """
        Get a photo by _id.
        """
        photo(_id: ObjectID!): Photo
        """
        Get a set of photos. If _ids is omitted, the API will return all photos.
        """
        photos(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Photo>
        """
        Get the permissions of the currently authenticated user for this
        collection.
        """
        photoActionAccess: CollectionActionAccess
      }
  
      type Mutation {
        """
        Create a new photo.
        """
        photoCreate(name: String!): Photo
        """
        Modify an existing photo.
        """
        photoModify(_id: ObjectID!, input: PhotoModifyInput!): Photo
        """
        Toggle whether the hidden property is set to true for an existing photo.
        This mutation sets hidden: true by default.
        Hidden photos should not be presented to clients; this should be used as
        a deletion that retains the data in case it is needed later.
        """
        photoHide(_id: ObjectID!, hide: Boolean): Photo
        """
        Toggle whether the locked property is set to true for an existing photo.
        This mutation sets locked: true by default.
        Locked photos should only be editable by the server and by admins.
        """
        photoLock(_id: ObjectID!, lock: Boolean): Photo
        """
        Add a watcher to a photo.
        This mutation adds the watcher by default.
        This mutation will use the signed in photo if watcher is not defined.
        """
        photoWatch(_id: ObjectID!, watcher: ObjectID, watch: Boolean): Photo
        """
        Deletes a photo account.
        """
        photoDelete(_id: ObjectID!): Void
        """
        Publishes an existing photo.
        """
        photoPublish(_id: ObjectID!, published_at: Date, publish: Boolean): Photo
      }
  
      extend type Subscription {
        """
        Sends photo documents when they are created.
        """
        photoCreated(): Photo
        """
        Sends the updated photo document when it changes.
        If _id is omitted, the server will send changes for all photos.
        """
        photoModified(_id: ObjectID): Photo
        """
        Sends photo _id when it is deleted.
        If _id is omitted, the server will send _ids for all deleted photos.
        """
        photoDeleted(_id: ObjectID): Photo
      }
    `,
    resolvers: {
      Query: {
        photo: (_, args, context: Context) =>
          findDoc({
            model: 'Photo',
            _id: args._id,
            context,
            accessRule: {},
          }),
        photos: (_, args, context: Context) => findDocs({ model: 'Photo', args, context, accessRule: {} }),
        photoActionAccess: (_, __, context: Context) => getCollectionActionAccess({ model: 'Photo', context }),
      },
      Mutation: {
        photoCreate: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'CREATED', createDoc({ model: 'Photo', args, context, withPermissions: true })),
        photoModify: (_, { _id, input }, context: Context) =>
          withPubSub('PHOTO', 'MODIFIED', modifyDoc({ model: 'Photo', data: { ...input, _id }, context })),
        photoHide: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'MODIFIED', hideDoc({ model: 'Photo', args, context })),
        photoLock: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'MODIFIED', lockDoc({ model: 'Photo', args, context })),
        photoWatch: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'MODIFIED', watchDoc({ model: 'Photo', args, context })),
        photoDelete: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'DELETED', deleteDoc({ model: 'Photo', args, context })),
        photoPublish: async (_, args, context: Context) =>
          withPubSub('PHOTO', 'DELETED', publishDoc({ model: 'Photo', args, context })),
      },
      PhotoPeople: {
        ...collectionPeopleResolvers,
        uploaded_by: ({ uploaded_by }) => getUsers(uploaded_by),
      },
      Subscription: {
        photoCreated: { subscribe: () => pubsub.asyncIterator(['PHOTO_CREATED']) },
        photoModified: { subscribe: () => pubsub.asyncIterator(['PHOTO_MODIFIED']) },
        photoDeleted: { subscribe: () => pubsub.asyncIterator(['PHOTO_DELETED']) },
      },
    },
    schemaFields: () => ({
      name: { type: String, required: true, default: 'Untitled photo' },
      people: {
        photo_created_by: { type: String },
        uploaded_by: { type: mongoose.Schema.Types.ObjectId },
      },
      permissions: {
        teams: { type: [String], default: [Teams.ANY] },
      },
      tags: { type: [String] },
      file_type: { type: String, default: undefined },
      photo_url: { type: String, default: '' },
      dimensions: {
        x: { type: Number },
        y: { type: Number },
      },
      versions: { type: {} },
      legacy_caption: { type: String },
      legacy_thumbnail_id: { type: String },
    }),
    actionAccess: (Users, Teams) => ({
      get: { teams: [Teams.ANY], users: [] },
      create: { teams: [Teams.ANY], users: [] },
      modify: { teams: [Teams.ANY], users: [] },
      hide: { teams: [Teams.ANY], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      publish: { teams: [Teams.ADMIN], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    }),
  };
};

interface IPhoto extends CollectionSchemaFields, CollectionSchemaFields, WithPermissionsCollectionSchemaFields {
  name: string;
  people: IPhotoPeople & CollectionSchemaFields['people'];
  tags?: string[];
  file_type?: string;
  photo_url: string;
  dimensions?: {
    x?: number;
    y?: number;
  };
  versions?: IPhoto[]; // store previous versions of the photo profile (only via v2 api)
  legacy_caption?: string;
  legacy_thumbnail_id?: string;
}

interface IPhotoPeople {
  photo_created_by?: string;
  uploaded_by?: mongoose.Types.ObjectId;
}

interface IPhotoDoc extends IPhoto, mongoose.Document {}

export type { IPhoto, IPhotoDoc };
export { photos };
