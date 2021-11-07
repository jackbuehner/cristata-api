import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import {
  CollectionSchemaFields,
  GitHubUserID,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
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
  withPubSub,
} from './helpers';

const flush: Collection = {
  name: 'Flush',
  canPublish: true,
  withPermissions: true,
  typeDefs: gql`
    type Flush inherits PublishableCollection, WithPermissions {
      events: [FlushEvent]
      articles: FlushArticles
      timestamps: FlushTimestamps
      volume: Int
      issue: Int
      left_advert_photo_url: String
    }

    type FlushEvent {
      name: String!
      date: String!
      location: String!
    }
 
    type FlushArticles {
      featured: Article
      more: [Article]
    }

    type FlushTimestamps inherits PublishableCollectionTimestamps {
      week: Date!
    }

    input FlushModifyInput {
      events: [FlushModifyInputEvent]
      articles: FlushModifyInputArticles
      timestamps: FlushModifyInputTimestamps
      volume: Int
      issue: Int
      left_advert_photo_url: String
    }

    input FlushModifyInputEvent {
      name: String!
      date: String!
      location: String!
    }

    input FlushModifyInputArticles {
      featured: ObjectID
      more: [ObjectID]
    }

    input FlushModifyInputTimestamps {
      week: Date
    }

    type Query {
      """
      Get a flush by _id.
      """
      flush(_id: ObjectID!): Flush
      """
      Get a set of flushes. If _ids is omitted, the API will return all flushes.
      """
      flushes(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Flush>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      flushActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new flush.
      """
      flushCreate(github_id: Int, name: String!): Flush
      """
      Modify an existing flush.
      """
      flushModify(_id: ObjectID!, input: FlushModifyInput!): Flush
      """
      Toggle whether the hidden property is set to true for an existing flush.
      This mutation sets hidden: true by default.
      Hidden flushes should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      flushHide(_id: ObjectID!, hide: Boolean): Flush
      """
      Toggle whether the locked property is set to true for an existing flush.
      This mutation sets locked: true by default.
      Locked flushes should only be editable by the server and by admins.
      """
      flushLock(_id: ObjectID!, lock: Boolean): Flush
      """
      Add a watcher to a flush.
      This mutation adds the watcher by default.
      This mutation will use the signed in flush if watcher is not defined.
      """
      flushWatch(_id: ObjectID!, watcher: Int, watch: Boolean): Flush
      """
      Deletes a flush account.
      """
      flushDelete(_id: ObjectID!): Void
      """
      Publishes an existing flush.
      """
      flushPublish(_id: ObjectID!, published_at: Date, publish: Boolean): Flush
    }

    extend type Subscription {
      """
      Sends flush documents when they are created.
      """
      flushCreated(): Flush
      """
      Sends the updated flush document when it changes.
      If _id is omitted, the server will send changes for all flushs.
      """
      flushModified(_id: ObjectID): Flush
      """
      Sends flush _id when it is deleted.
      If _id is omitted, the server will send _ids for all deleted flushs.
      """
      flushDeleted(_id: ObjectID): Flush
    }
  `,
  resolvers: {
    Query: {
      flush: (_, args, context: Context) =>
        findDoc({
          model: 'Flush',
          _id: args._id,
          context,
        }),
      flushes: (_, args, context: Context) => findDocs({ model: 'Flush', args, context }),
      flushActionAccess: (_, __, context: Context) => getCollectionActionAccess({ model: 'Flush', context }),
    },
    Mutation: {
      flushCreate: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'CREATED', createDoc({ model: 'Flush', args, context })),
      flushModify: (_, { _id, input }, context: Context) =>
        withPubSub('FLUSH', 'MODIFIED', modifyDoc({ model: 'Flush', data: { ...input, _id }, context })),
      flushHide: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'MODIFIED', hideDoc({ model: 'Flush', args, context })),
      flushLock: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'MODIFIED', lockDoc({ model: 'Flush', args, context })),
      flushWatch: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'MODIFIED', watchDoc({ model: 'Flush', args, context })),
      flushDelete: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'DELETED', deleteDoc({ model: 'Flush', args, context })),
      flushPublish: async (_, args, context: Context) =>
        withPubSub('FLUSH', 'MODIFIED', publishDoc({ model: 'Flush', args, context })),
    },
    /*FlushArticles: {
      featured: ({ created_by }) => getArt(created_by),
      more: ({ created_by }) => getUsers(created_by),
    }*/
    FlushArticles: {
      featured: ({ featured }, __, context: Context) => findDoc({ model: 'Article', _id: featured, context }),
      more: async ({ more }, __, context: Context) => {
        if (more.length > 0) {
          const test = await findDocs({
            model: 'Article',
            args: { _ids: more, limit: 100 },
            context,
          });
          return test.docs;
        }
        return [];
      },
    },
    Subscription: {
      flushCreated: { subscribe: () => pubsub.asyncIterator(['SHORTURL_CREATED']) },
      flushModified: { subscribe: () => pubsub.asyncIterator(['SHORTURL_MODIFIED']) },
      flushDeleted: { subscribe: () => pubsub.asyncIterator(['SHORTURL_DELETED']) },
    },
  },
  schemaFields: (Users, Teams) => ({
    name: { type: String, required: true, default: 'New Flush' },
    slug: { type: String },
    permissions: {
      teams: { type: [String], default: [Teams.MANAGING_EDITOR] },
    },
    timestamps: {
      target_publish_at: {
        type: Date,
        default: '0001-01-01T01:00:00.000+00:00',
      },
    },
    people: {
      authors: { type: [Number], default: [] },
      display_authors: { type: [String], default: [] },
      editors: {
        primary: { type: [Number] },
        copy: { type: [Number] },
      },
    },
    stage: { type: Number, default: Stage.PLANNING },
    tags: { type: [String] },
    description: { type: String, default: '' },
    photo_path: { type: String, default: '' },
    photo_credit: { type: String, default: '' },
    photo_caption: { type: String, default: '' },
    body: { type: String },
    versions: { type: {} },
    legacy_html: { type: Boolean, default: false },
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
  PLANNING = 1.1,
  DRAFT = 2.1,
  PENDING_EDIT = 3.4,
  PENDING_UPLOAD = 4.1,
  UPLOADED = 5.1,
  PUBLISHED = 5.2,
}

interface IFlush
  extends CollectionSchemaFields,
    PublishableCollectionSchemaFields,
    WithPermissionsCollectionSchemaFields {
  name: string;
  slug: string;
  timestamps: IFlushTimestamps &
    CollectionSchemaFields['timestamps'] &
    PublishableCollectionSchemaFields['timestamps'];
  people: IFlushPeople & CollectionSchemaFields['people'] & PublishableCollectionSchemaFields['people'];
  stage: Stage;
  tags: string[];
  description: string;
  photo_path: string;
  photo_credit: string;
  photo_caption: string;
  body?: string;
  versions?: IFlush[]; // store previous versions of the flush profile (only via v2 api)
  legacy_html: boolean; // true if it is html from the old webflow
}

interface IFlushTimestamps {
  target_publish_at?: string; // ISO string
}

interface IFlushPeople {
  authors: GitHubUserID[];
  display_authors: string[];
  editors: {
    primary: GitHubUserID[];
    copy: GitHubUserID[];
  };
}

interface IFlushDoc extends IFlush, mongoose.Document {}

export type { IFlush, IFlushDoc };
export { flush, Stage as EnumFlushStage };
