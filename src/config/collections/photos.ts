import { Context, gql } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import { CollectionSchemaFields, GitHubUserID, WithPermissionsCollectionSchemaFields } from '../../mongodb/db';
import {
  createDoc,
  deleteDoc,
  findDoc,
  findDocs,
  getCollectionActionAccess,
  hideDoc,
  lockDoc,
  modifyDoc,
  publishDoc,
  watchDoc,
} from './helpers';

const photos: Collection = {
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
    }

    type PhotoDimensions {
      x: Int
      y: Int
    }

    type PhotoPeople inherits CollectionPeople {
      photo_created_by: String
      uploaded_by: Int
    }

    input PhotoModifyInput {
      name: String
      tags: [String]
      file_type: String
      photo_url: String
      dimensions: PhotoModifyInputDimensions
      people: PhotoModifyInputPeople
    }

    input PhotoModifyInputDimensions {
      x: Int
      y: Int
    }

    input PhotoModifyInputPeople {
      photo_created_by: String
      uploaded_by: Int
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
      photoCreate(github_id: Int, name: String!): Photo
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
      photoWatch(_id: ObjectID!, watcher: Int, watch: Boolean): Photo
      """
      Deletes a photo account.
      """
      photoDelete(_id: ObjectID!): Void
      """
      Publishes an existing photo.
      """
      photoPublish(_id: ObjectID!, published_at: Date, publish: Boolean): Photo
    }
  `,
  resolvers: {
    Query: {
      photo: (_, args, context: Context) =>
        findDoc({
          model: 'Photo',
          _id: args._id,
          context,
        }),
      photos: (_, args, context: Context) => findDocs({ model: 'Photo', args, context }),
      photoActionAccess: (_, __, context: Context) => getCollectionActionAccess({ model: 'Photo', context }),
    },
    Mutation: {
      photoCreate: (_, args, context: Context) => createDoc({ model: 'Photo', args, context }),
      photoModify: (_, { _id, input }, context: Context) =>
        modifyDoc({ model: 'Photo', data: { ...input, _id }, context }),
      photoHide: (_, args, context: Context) => hideDoc({ model: 'Photo', args, context }),
      photoLock: (_, args, context: Context) => lockDoc({ model: 'Photo', args, context }),
      photoWatch: (_, args, context: Context) => watchDoc({ model: 'Photo', args, context }),
      photoDelete: (_, args, context: Context) => deleteDoc({ model: 'Photo', args, context }),
      photoPublish: (_, args, context: Context) => publishDoc({ model: 'Photo', args, context }),
    },
  },
  schemaFields: () => ({
    name: { type: String, required: true, default: 'Untitled photo' },
    people: {
      photo_created_by: { type: String },
      uploaded_by: { type: Number },
    },
    tags: { type: [String] },
    file_type: { type: [String], default: undefined },
    photo_url: { type: String, default: '' },
    dimensions: {
      x: { type: Number },
      y: { type: Number },
    },
    versions: { type: {} },
  }),
  permissions: (Users, Teams) => ({
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
}

interface IPhotoPeople {
  photo_created_by?: string;
  uploaded_by?: GitHubUserID;
}

interface IPhotoDoc extends IPhoto, mongoose.Document {}

export type { IPhoto, IPhotoDoc };
export { photos };
