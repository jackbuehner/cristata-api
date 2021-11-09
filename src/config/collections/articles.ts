import { Context, getUsers, gql, publishableCollectionPeopleResolvers, pubsub } from '../../apollo';
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
  findDocAndPrune,
  findDocs,
  findDocsAndPrune,
  getCollectionActionAccess,
  hideDoc,
  lockDoc,
  modifyDoc,
  pruneDocs,
  publishDoc,
  watchDoc,
  withPubSub,
} from './helpers';
import { PRUNED_USER_KEEP_FIELDS } from './users';

const PRUNED_ARTICLE_KEEP_FIELDS = [
  '_id',
  'timestamps.published_at',
  'timestamps.updated_at',
  'people.authors',
  'name',
  'categories',
  'tags',
  'description',
  'photo_path',
  'video_path',
  'photo_caption',
  'show_comments',
  'legacy_html',
  'body',
  'slug',
  'featured_order',
  'photo_credit',
];

const articles: Collection = {
  name: 'Article',
  canPublish: true,
  withPermissions: true,
  typeDefs: gql`
    type Article inherits PublishableCollection, WithPermissions {
      name: String!
      slug: String
      stage: Float
      categories: [String]
      tags: [String]
      description: String!
      photo_path: String!
      video_path: String!
      photo_caption: String!
      body: String
      show_comments: Boolean!
      legacy_html: Boolean!
      people: ArticlePeople
      timestamps: ArticleTimestamps
    }

    type ArticlePeople inherits PublishableCollectionPeople {
      authors: [User]!
      editors: ArticleEditors!
    }

    type ArticleEditors {
      primary: [User]!
      copy: [User]!
    }

    type ArticleTimestamps inherits PublishableCollectionTimestamps {
      target_publish_at: Date
    }

    type PrunedArticle {
      _id: ObjectID!
      name: String!
      slug: String
      categories: [String]!
      tags: [String]!
      description: String!
      photo_path: String!
      video_path: String!
      photo_caption: String!
      body: String
      show_comments: Boolean!
      legacy_html: Boolean!
      people: PrunedArticlePeople
      timestamps: PrunedArticleTimestamps
    }

    type PrunedArticlePeople {
      authors: [PrunedUser]!
    }

    type PrunedArticleTimestamps {
      published_at: Date!
      updated_at: Date!
    }

    input ArticleModifyInput {
      name: String
      slug: String
      stage: Float
      categories: [String]
      tags: [String]
      description: String
      photo_path: String
      video_path: String
      photo_caption: String
      body: String
      legacy_html: Boolean
      people: ArticleModifyInputPeople
      timestamps: ArticleModifyInputTimestamps
    }

    input ArticleModifyInputPeople {
      authors: [Int]
      editors: ArticleModifyInputPeopleEditors
    }

    input ArticleModifyInputPeopleEditors {
      primary: [Int]
      copy: [Int]
    }

    input ArticleModifyInputTimestamps {
      target_publish_at: Date
    }

    type Query {
      """
      Get a article by _id.
      """
      article(_id: ObjectID!): Article
      """
      Get a article by _id with confidential information pruned.
      """
      articlePublic(_id: ObjectID!): PrunedArticle
      """
      Get a set of articles. If _ids is omitted, the API will return all articles.
      """
      articles(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Article>
      """
      Get a set of articles with confidential information pruned. If _ids is
      omitted, the API will return all articles.
      """
      articlesPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<PrunedArticle>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      articleActionAccess: CollectionActionAccess
    }

    type Mutation {
      """
      Create a new article.
      """
      articleCreate(github_id: Int, name: String!): Article
      """
      Modify an existing article.
      """
      articleModify(_id: ObjectID!, input: ArticleModifyInput!): Article
      """
      Toggle whether the hidden property is set to true for an existing article.
      This mutation sets hidden: true by default.
      Hidden articles should not be presented to clients; this should be used as
      a deletion that retains the data in case it is needed later.
      """
      articleHide(_id: ObjectID!, hide: Boolean): Article
      """
      Toggle whether the locked property is set to true for an existing article.
      This mutation sets locked: true by default.
      Locked articles should only be editable by the server and by admins.
      """
      articleLock(_id: ObjectID!, lock: Boolean): Article
      """
      Add a watcher to a article.
      This mutation adds the watcher by default.
      This mutation will use the signed in article if watcher is not defined.
      """
      articleWatch(_id: ObjectID!, watcher: Int, watch: Boolean): Article
      """
      Deletes a article account.
      """
      articleDelete(_id: ObjectID!): Void
      """
      Publishes an existing article.
      """
      articlePublish(_id: ObjectID!, published_at: Date, publish: Boolean): Article
    }

    extend type Subscription {
      """
      Sends article documents when they are created.
      """
      articleCreated(): Article
      """
      Sends the updated article document when it changes.
      If _id is omitted, the server will send changes for all articles.
      """
      articleModified(_id: ObjectID): Article
      """
      Sends article _id when it is deleted.
      If _id is omitted, the server will send _ids for all deleted articles.
      """
      articleDeleted(_id: ObjectID): Article
    }
  `,
  resolvers: {
    Query: {
      article: (_, args, context: Context) => findDoc({ model: 'Article', _id: args._id, context }),
      articlePublic: (_, args, context: Context) =>
        findDocAndPrune({
          model: 'Article',
          _id: args._id,
          context,
          keep: PRUNED_ARTICLE_KEEP_FIELDS,
          fullAccess: true,
        }),
      articles: (_, args, context: Context) => findDocs({ model: 'Article', args, context }),
      articlesPublic: async (_, args, context: Context) =>
        findDocsAndPrune({
          model: 'Article',
          args,
          context,
          keep: PRUNED_ARTICLE_KEEP_FIELDS,
          fullAccess: true,
        }),
      articleActionAccess: (_, __, context: Context) =>
        getCollectionActionAccess({ model: 'Article', context }),
    },
    Mutation: {
      articleCreate: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'CREATED', createDoc({ model: 'Article', args, context })),
      articleModify: (_, { _id, input }, context: Context) =>
        withPubSub('ARTICLE', 'MODIFIED', modifyDoc({ model: 'Article', data: { ...input, _id }, context })),
      articleHide: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'MODIFIED', hideDoc({ model: 'Article', args, context })),
      articleLock: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'MODIFIED', lockDoc({ model: 'Article', args, context })),
      articleWatch: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'MODIFIED', watchDoc({ model: 'Article', args, context })),
      articleDelete: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'DELETED', deleteDoc({ model: 'Article', args, context })),
      articlePublish: async (_, args, context: Context) =>
        withPubSub('ARTICLE', 'MODIFIED', publishDoc({ model: 'Article', args, context })),
    },
    ArticlePeople: {
      ...publishableCollectionPeopleResolvers,
      authors: ({ authors }) => getUsers(authors),
    },
    ArticleEditors: {
      primary: ({ primary }) => getUsers(primary),
      copy: ({ copy }) => getUsers(copy),
    },
    PrunedArticlePeople: {
      authors: async ({ authors }) => {
        // if there are no authers, return an empty array
        if (authors.length === 0) return [];
        // otherwise, get and prune the user profile for each author
        const promise = getUsers(authors);
        if (Array.isArray(promise)) {
          return pruneDocs({
            input: await Promise.all<mongoose.Document>(promise),
            keep: PRUNED_USER_KEEP_FIELDS,
          });
        } else {
          return pruneDocs({
            input: [(await promise) as mongoose.Document],
            keep: PRUNED_USER_KEEP_FIELDS,
          });
        }
      },
    },
    Subscription: {
      articleCreated: { subscribe: () => pubsub.asyncIterator(['ARTICLE_CREATED']) },
      articleModified: { subscribe: () => pubsub.asyncIterator(['ARTICLE_MODIFIED']) },
      articleDeleted: { subscribe: () => pubsub.asyncIterator(['ARTICLE_DELETED']) },
    },
  },
  schemaFields: (Users, Teams) => ({
    name: { type: String, required: true, default: 'New Article' },
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
      editors: {
        primary: { type: [Number] },
        copy: { type: [Number] },
      },
    },
    stage: { type: Number, default: Stage.Planning },
    categories: { type: [String] },
    tags: { type: [String] },
    description: { type: String, default: '' },
    photo_path: { type: String, default: '' },
    video_path: { type: String, default: '' },
    photo_caption: { type: String, default: '' },
    body: { type: String },
    versions: { type: {} },
    legacy_html: { type: Boolean, default: false },
    show_comments: { type: Boolean, default: false },
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
  'Planning' = 1.1,
  'Draft' = 2.1,
  'Editor Review' = 3.1,
  'Copy Edit' = 3.3,
  'Writer/Editor Check' = 3.5,
  'Upload Approval' = 4.1,
  'Uploaded/Scheduled' = 5.1,
  'Published' = 5.2,
}

interface IArticle
  extends CollectionSchemaFields,
    PublishableCollectionSchemaFields,
    WithPermissionsCollectionSchemaFields {
  name: string;
  slug?: string;
  timestamps: IArticleTimestamps &
    CollectionSchemaFields['timestamps'] &
    PublishableCollectionSchemaFields['timestamps'];
  people: IArticlePeople & CollectionSchemaFields['people'] & PublishableCollectionSchemaFields['people'];
  stage: Stage;
  categories: string[];
  tags: string[];
  description: string;
  photo_path: string;
  video_path: string;
  photo_caption: string;
  body?: string;
  versions?: IArticle[]; // store previous versions of the article profile (only via v2 api)
  show_comments: boolean; // whether commenting on article should be enabled (for website, not cms)
  legacy_html: boolean; // true if it is html from the old webflow
}

interface IArticleTimestamps {
  target_publish_at?: string; // ISO string
}

interface IArticlePeople {
  authors: GitHubUserID[];
  editors: {
    primary: GitHubUserID[];
    copy: GitHubUserID[];
  };
}

interface IArticleDoc extends IArticle, mongoose.Document {}

export type { IArticle, IArticleDoc };
export { articles, Stage as EnumArticleStage, PRUNED_ARTICLE_KEEP_FIELDS };
