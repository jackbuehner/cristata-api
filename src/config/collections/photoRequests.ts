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

const photoRequests: Collection = {
  name: 'PhotoRequest',
  canPublish: false,
  withPermissions: true,
  typeDefs: gql`
    type PhotoRequest inherits Collection, WithPermissions {
      name: String!
      stage: Float
      article_id: ObjectID
      people: PhotoRequestPeople
    }

    type PhotoRequestPeople inherits CollectionPeople {
      requested_by: Int
    }

    input PhotoRequestModifyInput {
      name: String
      stage: Float
      article_id: ObjectID
      people: PhotoRequestModifyInputPeople
    }

    input PhotoRequestModifyInputPeople {
      requested_by: Int
    }

    type Query {
      """
      Get a photoRequest by _id.
      """
      photoRequest(_id: ObjectID!): PhotoRequest
      """
      Get a set of photoRequests. If _ids is omitted, the API will return all photoRequests.
      """
      photoRequests(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<PhotoRequest>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      photoRequestActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new photoRequest.
      """
      photoRequestCreate(github_id: Int, name: String!): PhotoRequest
      """
      Modify an existing photoRequest.
      """
      photoRequestModify(_id: ObjectID!, input: PhotoRequestModifyInput!): PhotoRequest
      """
      Toggle whether the hidden property is set to true for an existing photoRequest.
      This mutation sets hidden: true by default.
      Hidden photoRequests should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      photoRequestHide(_id: ObjectID!, hide: Boolean): PhotoRequest
      """
      Toggle whether the locked property is set to true for an existing photoRequest.
      This mutation sets locked: true by default.
      Locked photoRequests should only be editable by the server and by admins.
      """
      photoRequestLock(_id: ObjectID!, lock: Boolean): PhotoRequest
      """
      Add a watcher to a photoRequest.
      This mutation adds the watcher by default.
      This mutation will use the signed in photoRequest if watcher is not defined.
      """
      photoRequestWatch(_id: ObjectID!, watcher: Int, watch: Boolean): PhotoRequest
      """
      Deletes a photoRequest account.
      """
      photoRequestDelete(_id: ObjectID!): Void
      """
      Publishes an existing photoRequest.
      """
      photoRequestPublish(_id: ObjectID!, published_at: Date, publish: Boolean): PhotoRequest
    }
  `,
  resolvers: {
    Query: {
      photoRequest: (_, args, context: Context) =>
        findDoc({
          model: 'PhotoRequest',
          _id: args._id,
          context,
        }),
      photoRequests: (_, args, context: Context) => findDocs({ model: 'PhotoRequest', args, context }),
      photoRequestActionAccess: (_, __, context: Context) =>
        getCollectionActionAccess({ model: 'PhotoRequest', context }),
    },
    Mutation: {
      photoRequestCreate: (_, args, context: Context) => createDoc({ model: 'PhotoRequest', args, context }),
      photoRequestModify: (_, { _id, input }, context: Context) =>
        modifyDoc({ model: 'PhotoRequest', data: { ...input, _id }, context }),
      photoRequestHide: (_, args, context: Context) => hideDoc({ model: 'PhotoRequest', args, context }),
      photoRequestLock: (_, args, context: Context) => lockDoc({ model: 'PhotoRequest', args, context }),
      photoRequestWatch: (_, args, context: Context) => watchDoc({ model: 'PhotoRequest', args, context }),
      photoRequestDelete: (_, args, context: Context) => deleteDoc({ model: 'PhotoRequest', args, context }),
      photoRequestPublish: (_, args, context: Context) => publishDoc({ model: 'PhotoRequest', args, context }),
    },
  },
  schemaFields: (Users, Teams) => ({
    name: { type: String, required: true, default: 'New photo request' },
    permissions: {
      teams: { type: [String], default: [Teams.MANAGING_EDITOR] },
    },
    people: {
      requested_by: { type: Number },
    },
    stage: { type: Number, default: Stage.NEW },
    versions: { type: {} },
    article_id: { type: String, default: '' },
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

enum Stage {
  NEW = 1.1,
  IN_PROGRESS = 2.1,
  FULFILLED = 3.1,
}

interface IPhotoRequest
  extends CollectionSchemaFields,
    CollectionSchemaFields,
    WithPermissionsCollectionSchemaFields {
  name: string;
  people: IPhotoRequestPeople & CollectionSchemaFields['people'];
  stage: Stage;
  article_id?: string;
  versions?: IPhotoRequest[]; // store previous versions of the photoRequest profile (only via v2 api)
}

interface IPhotoRequestPeople {
  requested_by?: GitHubUserID;
}

interface IPhotoRequestDoc extends IPhotoRequest, mongoose.Document {}

export type { IPhotoRequest, IPhotoRequestDoc };
export { photoRequests, Stage as EnumPhotoRequestStage };
