import { Context, gql, pubsub } from '../../apollo';
import { Collection } from '../database';
import mongoose from 'mongoose';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import {
  createDoc,
  deleteDoc,
  findDoc,
  findDocAndPrune,
  findDocs,
  findDocsAndPrune,
  getCollectionActionAccess,
  hideDoc,
  lockDoc,
  modifyDoc,
  publishDoc,
  watchDoc,
  withPubSub,
} from './helpers';
import { PRUNED_ARTICLE_KEEP_FIELDS } from './articles';

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
      date: Date!
      location: String!
    }
 
    type FlushArticles {
      featured: Article
      more: [Article]
    }

    type FlushTimestamps inherits PublishableCollectionTimestamps {
      week: Date!
    }

    type PrunedFlush {
      _id: ObjectID
      events: [FlushEvent]
      articles: PrunedFlushArticles
      timestamps: PrunedFlushTimestamps
      volume: Int
      issue: Int
      left_advert_photo_url: String
    }

    type PrunedFlushArticles {
      featured: PrunedArticle
      more: [PrunedArticle]
    }

    type PrunedFlushTimestamps {
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
      Get a set of pruned flushes. If _ids is omitted, the API will return all flushes.
      """
      flushesPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<PrunedFlush>
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
      flushCreate(volume: Int!, issue: Int!): Flush
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
      flushesPublic: (_, args, context: Context) => {
        return findDocsAndPrune({
          model: 'Flush',
          args,
          context,
          keep: [
            '_id',
            'events',
            'articles.featured',
            'articles.more',
            'timestamps.week',
            'volume',
            'issue',
            'left_advert_photo_url',
          ],
          fullAccess: true,
        });
      },
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
        if (more && more.length > 0) {
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
    PrunedFlushArticles: {
      featured: ({ featured }, __, context: Context) => {
        if (featured) {
          return findDocAndPrune({
            model: 'Article',
            _id: featured,
            context,
            keep: PRUNED_ARTICLE_KEEP_FIELDS,
            fullAccess: true,
          });
        }
        return null;
      },
      more: async ({ more }, __, context: Context) => {
        if (more && more.length > 0) {
          const articles = await findDocsAndPrune({
            model: 'Article',
            args: { _ids: more, limit: 100 },
            context,
            keep: PRUNED_ARTICLE_KEEP_FIELDS,
            fullAccess: true,
          });
          return articles.docs;
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
    volume: { type: Number, default: 1 },
    issue: { type: Number, default: 1 },
    events: [
      new mongoose.Schema({
        name: { type: String, required: true, default: 'New event' },
        date: { type: Date, required: true, default: '0001-01-01T01:00:00.000+00:00' },
        location: { type: String, required: true, default: 'location' },
      }),
    ],
    permissions: {
      teams: { type: [String], default: [Teams.ADMIN] },
    },
    timestamps: {
      week: {
        type: Date,
        default: '0001-01-01T01:00:00.000+00:00',
      },
    },
    articles: {
      featured: { type: mongoose.Types.ObjectId },
      more: [{ type: mongoose.Types.ObjectId }],
    },
    left_advert_photo_url: { type: String },
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
  volume: number;
  issue: number;
  events: Array<{
    name: string;
    date: string; // ISO string
    location: string;
  }>;
  people: PublishableCollectionSchemaFields['people'] & CollectionSchemaFields['people'];
  timestamps: IFlushTimestamps &
    CollectionSchemaFields['timestamps'] &
    PublishableCollectionSchemaFields['timestamps'];
  articles?: {
    featured?: mongoose.Types.ObjectId;
    more?: mongoose.Types.ObjectId[];
  };
  left_advert_photo_url?: string;
  versions?: IFlush[]; // store previous versions of the flush profile (only via v2 api)
}

interface IFlushTimestamps {
  week?: string; // ISO string
}

interface IFlushDoc extends IFlush, mongoose.Document {}

export type { IFlush, IFlushDoc };
export { flush, Stage as EnumFlushStage };
