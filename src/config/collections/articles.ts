import { Context, publishableCollectionPeopleResolvers, pubsub } from '../../apollo';
import { Collection, Teams } from '../database';
import mongoose from 'mongoose';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import {
  CollectionDoc,
  createDoc,
  deleteDoc,
  findDoc,
  findDocAndPrune,
  findDocs,
  findDocsAndPrune,
  getCollectionActionAccess,
  getUsers,
  gql,
  hideDoc,
  lockDoc,
  modifyDoc,
  pruneDocs,
  publishDoc,
  watchDoc,
  withPubSub,
} from '../../api/v3/helpers';
import { IUserDoc, PRUNED_USER_KEEP_FIELDS } from './users';
import { isArray } from '../../utils/isArray';
import { dateAtTimeZero } from '../../utils/dateAtTimeZero';
import { slugify } from '../../utils/slugify';
import { sendEmail } from '../../utils/sendEmail';
import { ISettings } from './settings';

const PRUNED_ARTICLE_KEEP_FIELDS = [
  '_id',
  'timestamps.published_at',
  'timestamps.updated_at',
  'people.authors',
  'people.editors.primary',
  'people.editors.copy',
  'name',
  'categories',
  'tags',
  'description',
  'photo_path',
  'video_path',
  'video_replaces_photo',
  'photo_caption',
  'photo_credit',
  'video_replaces_photo',
  'show_comments',
  'legacy_html',
  'body',
  'slug',
  'featured_order',
  'layout',
  'template',
];

async function getPrunedUser(arr: []) {
  // if there are no users, return an empty array
  if (arr.length === 0) return [];
  // otherwise, get and prune the user profile for each user
  const users = await getUsers(arr);
  return pruneDocs({
    input: isArray(users) ? users : [users],
    keep: PRUNED_USER_KEEP_FIELDS,
  });
}

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
      video_replaces_photo: Boolean!
      photo_caption: String!
      body: String
      show_comments: Boolean!
      legacy_html: Boolean!
      people: ArticlePeople
      timestamps: ArticleTimestamps
      layout: String!
      template: String!
      legacy_comments: [ArticleLegacyComments]
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

    type ArticleLegacyComments {
      author_name: String!
      commented_at: String!
      content: String!
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
      video_replaces_photo: Boolean!
      photo_caption: String!
      photo_credit: String
      body: String
      show_comments: Boolean!
      legacy_html: Boolean!
      people: PrunedArticlePeople
      timestamps: PrunedArticleTimestamps
      layout: String!
      template: String!
    }

    type PrunedArticlePeople {
      authors: [PrunedUser]!
      editors: PrunedArticleEditors!
    }

    type PrunedArticleEditors {
      primary: [PrunedUser]!
      copy: [PrunedUser]!
    }

    type PrunedArticleTimestamps {
      published_at: Date!
      updated_at: Date!
    }

    type StageCount {
      _id: Float!
      count: Int!
    }

    input ArticleModifyInput inherits WithPermissionsInput {
      name: String
      slug: String
      stage: Float
      categories: [String]
      tags: [String]
      description: String
      photo_path: String
      video_path: String
      video_replaces_photo: Boolean
      photo_caption: String
      body: String
      show_comments: Boolean
      legacy_html: Boolean
      people: ArticleModifyInputPeople
      timestamps: ArticleModifyInputTimestamps
      layout: String
      template: String
    }

    input ArticleModifyInputPeople {
      authors: [ObjectID]
      editors: ArticleModifyInputPeopleEditors
    }

    input ArticleModifyInputPeopleEditors {
      primary: [ObjectID]
      copy: [ObjectID]
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
      Get a article by slug with confidential information pruned.

      Provide the date of the article to ensure that the correct article is provided
      (in case the slug is not unique).
      """
      articleBySlugPublic(slug: String!, date: Date): PrunedArticle
      """
      Get a set of articles. If _ids is omitted, the API will return all articles.
      """
      articles(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Article>
      """
      Get a set of articles with confidential information pruned. If _ids is
      omitted, the API will return all articles.
      """
      articlesPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!, featured: Boolean): Paged<PrunedArticle>
      """
      Get the permissions of the currently authenticated user for this
      collection.
      """
      articleActionAccess: CollectionActionAccess
      """
      Get the unique categories used in the articles collection. Category names are always returned lowercase with spaces
      replaced by hyphens.
      """
      articleCategoriesPublic: [String]
      """
      Get the unique tags used in the articles collection. The contains parameter should be used to narrow to search the
      results by whether it contains the provided string. Pagination is not available on this query. Uppercase letters are
      remplaced by lowercase letters and spaces are replaced by hyphens.
      """
      articleTagsPublic(limit: Int, contains: String): [String]
      """
      Get the number of articles in each stage.
      """
      articleStageCounts: [StageCount]
    }

    type Mutation {
      """
      Create a new article.
      """
      articleCreate(name: String!): Article
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
      articleWatch(_id: ObjectID!, watcher: ObjectID, watch: Boolean): Article
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
      article: (_, args, context: Context) =>
        findDoc({
          model: 'Article',
          _id: args._id,
          context,
          accessRule: context.profile.teams.includes(Teams.MANAGING_EDITOR) ? {} : undefined,
        }),
      articlePublic: async (_, args, context: Context) => {
        // get the article
        const prunedArticle = await findDocAndPrune({
          model: 'Article',
          _id: args._id,
          filter: { stage: Stage.Published },
          context,
          keep: PRUNED_ARTICLE_KEEP_FIELDS,
          fullAccess: true,
        });

        // add photo credit
        const constructedPrunedArticle = {
          ...prunedArticle,
          photo_credit: JSON.parse(
            JSON.stringify(
              await findDoc({
                model: 'Photo',
                by: 'photo_url',
                //@ts-expect-error photo_path exists on prunedArticle
                _id: prunedArticle.photo_path,
                context,
                fullAccess: true,
              })
            )
          )?.people?.photo_created_by,
        };

        // return the article
        return constructedPrunedArticle;
      },
      articles: (_, args, context: Context) =>
        findDocs({
          model: 'Article',
          args,
          context,
        }),
      articlesPublic: async (_, args, context: Context) => {
        // get the ids of the featured articles
        const featuredIds: mongoose.Types.ObjectId[] = [];
        if (args.featured === true) {
          const result = (
            await mongoose.model<ISettings>('Settings').findOne({ name: 'featured-articles' })
          ).toObject();
          const ids = result.setting as Record<string, mongoose.Types.ObjectId>;
          featuredIds.push(new mongoose.Types.ObjectId(ids.first));
          featuredIds.push(new mongoose.Types.ObjectId(ids.second));
          featuredIds.push(new mongoose.Types.ObjectId(ids.third));
          featuredIds.push(new mongoose.Types.ObjectId(ids.fourth));
        }

        // build a pipeline to only get the featured articles
        // (empty filter if featured !== true)
        const pipeline2: mongoose.PipelineStage[] =
          featuredIds.length > 0
            ? [
                {
                  $addFields: { featured_order: { $indexOfArray: [featuredIds, '$_id'] } }, // assign starting at 0
                },
                { $match: { featured_order: { $gte: 0 } } }, // eclude all articles exept ones within the featuredIds array
              ]
            : [];
        const sort = featuredIds.length > 0 ? { featured_order: 1, ...args.sort } : args.sort;

        // get the articles
        const articles = await findDocsAndPrune({
          model: 'Article',
          args: { ...args, filter: { ...args.filter, stage: Stage.Published }, pipeline2, sort },
          context,
          keep: PRUNED_ARTICLE_KEEP_FIELDS,
          fullAccess: true,
        });

        // get add photo credit to each public article
        const docs = await Promise.all(
          articles.docs.map(async (prunedArticle) => {
            return {
              ...prunedArticle,
              photo_credit: JSON.parse(
                JSON.stringify(
                  await findDoc({
                    model: 'Photo',
                    by: 'photo_url',
                    //@ts-expect-error photo_path exists on prunedArticle
                    _id: prunedArticle.photo_path,
                    context,
                    fullAccess: true,
                  })
                )
              )?.people?.photo_created_by,
            };
          })
        );
        return { ...articles, docs };
      },
      articleBySlugPublic: async (_, args, context: Context) => {
        // create filter to find newest article with matching slug
        const filter = args.date
          ? {
              'timestamps.published_at': {
                $gte: dateAtTimeZero(args.date),
                $lt: new Date(dateAtTimeZero(args.date).getTime() + 24 * 60 * 60 * 1000),
              },
              stage: Stage.Published,
            }
          : {
              stage: Stage.Published,
            };

        // get the article
        const prunedArticle = await findDocAndPrune({
          model: 'Article',
          by: 'slug',
          _id: args.slug,
          filter: filter,
          context,
          keep: PRUNED_ARTICLE_KEEP_FIELDS,
          fullAccess: true,
        });

        // add photo credit
        const constructedPrunedArticle = {
          ...prunedArticle,
          photo_credit: JSON.parse(
            JSON.stringify(
              await findDoc({
                model: 'Photo',
                by: 'photo_url',
                //@ts-expect-error photo_path exists on prunedArticle
                _id: prunedArticle.photo_path,
                context,
                fullAccess: true,
              })
            )
          )?.people?.photo_created_by,
        };

        // return the article
        return constructedPrunedArticle;
      },
      articleActionAccess: (_, __, context: Context) =>
        getCollectionActionAccess({ model: 'Article', context }),
      articleCategoriesPublic: async () => {
        const Model = mongoose.model<CollectionDoc>('Article');
        const categories: string[] = await Model.distinct('categories');
        return Array.from(new Set(categories.map((cat) => cat.toLowerCase().replace(' ', '-'))));
      },
      articleTagsPublic: async (_, args) => {
        const Model = mongoose.model<CollectionDoc>('Article');
        const tags: string[] = await Model.distinct('tags');
        let processed: string[] = tags.map((tag) => tag.toLowerCase().replace(' ', '-'));

        // filter to ensure the tag contains the specified string
        if (args.contains) {
          processed = processed.filter((tag) => tag.indexOf(args.contains) !== -1);
        }

        // limit the length of the response
        if (args.limit) {
          processed = processed.slice(0, args.limit);
        }

        // returned the procesed tags
        return Array.from(new Set(processed));
      },
      articleStageCounts: async () => {
        const Model = mongoose.model<CollectionDoc>('Article');
        // @ts-expect-error bug in mongoose: https://github.com/Automattic/mongoose/issues/11059
        return await Model.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]);
      },
    },
    Mutation: {
      articleCreate: async (_, args, context: Context) =>
        withPubSub(
          'ARTICLE',
          'CREATED',
          createDoc({
            model: 'Article',
            args,
            context,
            withPermissions: true,
          })
        ),
      articleModify: async (_, { _id, input }, context: Context) =>
        await withPubSub(
          'ARTICLE',
          'MODIFIED',
          modifyDoc({
            model: 'Article',
            data: { ...input, _id },
            context,
            modify: async (currentDoc: IArticle, data: IArticleInput) => {
              // set the slug if the document is being published and does not already have one
              if (data.stage === Stage.Published && (!data.slug || !currentDoc.slug)) {
                data.slug = slugify(input.name || currentDoc.name);
              }

              // send email alerts to the watchers if the stage changes
              if (currentDoc.people.watching && data.stage && data.stage !== currentDoc.stage) {
                // get emails of watchers
                const watchersEmails = await Promise.all(
                  (currentDoc.people.watching || currentDoc.people.watching).map(async (_id) => {
                    const profile = await mongoose.model<IUserDoc>('User').findById(_id); // get the profile, which may contain an email
                    return profile.email;
                  })
                );

                // get emails of authors and primary editors (if there are any) - mandatory watchers
                const mandatoryWatchersEmails = await Promise.all(
                  [
                    ...(data.people.authors || currentDoc.people.authors),
                    ...(data.people.editors?.primary || currentDoc.people.editors?.primary),
                  ].map(async (_id) => {
                    const profile = await mongoose.model<IUserDoc>('User').findById(_id); // get the profile, which may contain an email
                    return profile.email;
                  })
                );

                const email = (reason?: string) => {
                  return `
            <h1 style="font-size: 20px;">
              The Paladin Network
            </h1>
            <p>
              The stage has been changed for an article you are watching on Cristata.
              <br />
              To view the article, go to <a href="https://thepaladin.cristata.app/cms/item/articles/${_id}">https://thepaladin.cristata.app/cms/item/articles/${_id}</a>.
            </p>
            <p>
              <span>
                <b>Headline: </b>
                ${data.name || currentDoc.name}
              </span>
              <br />
              <span>
                <b>New Stage: </b>
                ${Stage[data.stage as Stage]}
              </span>
              <br />
              <span>
                <b>Unique ID: </b>
                ${_id}
              </span>
            </p>
            ${
              reason
                ? `
                  <p style="color: #888888">
                    You receievd this email because ${reason}.
                  </p>
                `
                : ''
            }
            <p style="color: #aaaaaa">
              Powered by Cristata
            </p>
          `;
                };

                // send email
                sendEmail(
                  watchersEmails,
                  `[Stage: ${Stage[data.stage as Stage]}] ${data.name || currentDoc.name}`,
                  email(`you clicked the 'Watch" button for this article in Cristata`)
                );
                sendEmail(
                  mandatoryWatchersEmails,
                  `[Stage: ${Stage[data.stage as Stage]}] ${data.name || currentDoc.name}`,
                  email(`you are an are an author or editor for this article`)
                );
              }
            },
          })
        ),
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
      authors: async ({ authors }) => getPrunedUser(authors),
    },
    PrunedArticleEditors: {
      primary: ({ primary }) => getPrunedUser(primary),
      copy: ({ copy }) => getPrunedUser(copy),
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
      teams: { type: [String], default: [Teams.MANAGING_EDITOR, Teams.COPY_EDITOR] },
    },
    timestamps: {
      target_publish_at: {
        type: Date,
        default: '0001-01-01T01:00:00.000+00:00',
      },
    },
    people: {
      authors: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      editors: {
        primary: { type: [mongoose.Schema.Types.ObjectId] },
        copy: { type: [mongoose.Schema.Types.ObjectId] },
      },
    },
    stage: { type: Number, default: Stage.Planning },
    categories: { type: [String] },
    tags: { type: [String] },
    description: { type: String, default: '' },
    photo_path: { type: String, default: '' },
    video_path: { type: String, default: '' },
    video_replaces_photo: { type: Boolean, default: false },
    photo_caption: { type: String, default: '' },
    body: { type: String },
    versions: { type: {} },
    legacy_html: { type: Boolean, default: false },
    show_comments: { type: Boolean, default: false },
    layout: { type: String, default: 'standard' }, // only supported on template 'jackbuehner2020' and newer
    template: { type: String, default: 'jackbuehner2020' },
    legacy_comments: {
      type: [
        {
          author_name: { type: String },
          commented_at: { type: Date },
          content: { type: String },
        },
      ],
    },
  }),
  actionAccess: (Users, Teams, context: Context) => {
    const users = [];
    if (context.profile.teams.includes(Teams.MANAGING_EDITOR)) users.push(context.profile._id);
    return {
      get: { teams: [Teams.ANY], users: [...users] },
      create: { teams: [Teams.ANY], users: [] },
      modify: { teams: [Teams.ANY], users: [] },
      hide: { teams: [Teams.ANY], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      publish: { teams: [Teams.ADMIN], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    };
  },
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
  video_replaces_photo: boolean;
  photo_caption: string;
  body?: string;
  versions?: IArticle[]; // store previous versions of the article profile (only via v2 api)
  show_comments: boolean; // whether commenting on article should be enabled (for website, not cms)
  legacy_html: boolean; // true if it is html from the old webflow
  layout: string;
  template: string;
  legacy_comments?: Array<{
    author_name: string;
    commented_at: string;
    content: string;
  }>;
}

interface IArticleInput
  extends Omit<Omit<Omit<Omit<IArticle, 'versions'>, 'legacy_comments'>, 'timestamps'>, 'people'> {
  timestamps?: IArticleTimestamps;
  people?: IArticlePeople;
}

interface IArticleTimestamps {
  target_publish_at?: string; // ISO string
}

interface IArticlePeople {
  authors: mongoose.Types.ObjectId[];
  editors: {
    primary: mongoose.Types.ObjectId[];
    copy: mongoose.Types.ObjectId[];
  };
}

interface IArticleDoc extends IArticle, mongoose.Document {}

export type { IArticle, IArticleDoc };
export { articles, Stage as EnumArticleStage, PRUNED_ARTICLE_KEEP_FIELDS };
