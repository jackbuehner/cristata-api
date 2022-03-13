import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import type { CollectionDoc, Helpers } from '../../api/v3/helpers';
import type { Context } from '../../apollo';
import type {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import { sendEmail } from '../../utils/sendEmail';
import { slugify } from '../../utils/slugify';
import type { Collection } from '../database';
import type { ISettings } from './settings';
import type { IUserDoc } from './users';

const articles = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const { findDoc, findDocs, gql, modifyDoc, withPubSub } = helpers;

  const collection = helpers.generators.genCollection({
    name: 'Article',
    canPublish: true,
    withPermissions: true,
    withSubscription: true,
    publicRules: { filter: { stage: Stage.Published }, slugDateField: 'timestamps.published_at' },
    schemaDef: {
      name: { type: String, required: true, modifiable: true, public: true, default: 'New Article' },
      slug: {
        type: String,
        modifiable: true,
        public: true,
        setter: {
          condition: { $and: [{ stage: { $eq: Stage.Published.toString() } }, { slug: { $exists: false } }] },
          value: { slugify: 'name' },
        },
      },
      stage: { type: 'Float', modifiable: true, default: Stage.Planning.toString() },
      categories: { type: [String], modifiable: true, public: true, default: [] },
      tags: { type: [String], modifiable: true, public: true, default: [] },
      description: { type: String, required: true, modifiable: true, public: true, default: '' },
      photo_path: { type: String, required: true, modifiable: true, public: true, default: '' },
      video_path: { type: String, required: true, modifiable: true, public: true, default: '' },
      video_replaces_photo: { type: Boolean, required: true, modifiable: true, public: true, default: false },
      photo_credit: {
        model: 'Photo',
        by: 'photo_url',
        matches: 'photo_path',
        field: 'people.photo_created_by',
        fieldType: String,
        public: true,
      },
      photo_caption: { type: String, required: true, modifiable: true, public: true, default: '' },
      body: { type: String, modifiable: true, public: true },
      legacy_html: { type: Boolean, required: true, modifiable: true, public: true, default: false },
      show_comments: { type: Boolean, required: true, modifiable: true, public: true, default: false },
      layout: { type: String, required: true, modifiable: true, public: true, default: 'standard' },
      template: { type: String, required: true, modifiable: true, public: true, default: 'jackbuehner2020' },
      claps: { type: Number, modifiable: true, public: true, default: 0 },
      people: {
        authors: {
          type: ['[User]', [mongoose.Schema.Types.ObjectId]],
          required: true,
          modifiable: true,
          public: true,
          default: [],
        },
        editors: {
          primary: {
            type: ['[User]', [mongoose.Schema.Types.ObjectId]],
            required: true,
            modifiable: true,
            public: true,
            default: [],
          },
          copy: {
            type: ['[User]', [mongoose.Schema.Types.ObjectId]],
            required: true,
            modifiable: true,
            public: true,
            default: [],
          },
        },
      },
      timestamps: {
        target_publish_at: { type: Date, modifiable: true, default: '0001-01-01T01:00:00.000+00:00' },
      },
      permissions: {
        teams: { type: [String], default: [Teams.MANAGING_EDITOR, Teams.COPY_EDITOR], required: true },
      },
      legacy_comments: [
        {
          author_name: { type: String, modifiable: false, public: true },
          commented_at: { type: Date, modifiable: false, public: true },
          content: { type: String, modifiable: false, public: true },
        },
      ],
    },
    Users,
    Teams,
    helpers,
    customQueries: [
      {
        name: 'stageCounts',
        description: 'Get the number of articles in each stage.',
        returns: `[{ _id: Float!, count: Int! }]`,
        // @ts-expect-error bug in mongoose: https://github.com/Automattic/mongoose/issues/11059
        pipeline: [{ $group: { _id: '$stage', count: { $sum: 1 } } }],
      },
    ],
    actionAccess: () => {
      return {
        get: { teams: [Teams.ANY], users: [] },
        create: { teams: [Teams.ANY], users: [] },
        modify: { teams: [Teams.ANY], users: [] },
        hide: { teams: [Teams.ANY], users: [] },
        lock: { teams: [Teams.ADMIN], users: [] },
        watch: { teams: [Teams.ANY], users: [] },
        publish: { teams: [Teams.ADMIN], users: [] },
        delete: { teams: [Teams.ADMIN], users: [] },
        bypassDocPermissions: { teams: [Teams.MANAGING_EDITOR], users: [] },
      };
    },
  });

  collection.resolvers = merge(collection.resolvers, {
    Query: {
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
        const articles = await findDocs({
          model: 'Article',
          args: { ...args, filter: { ...args.filter, stage: Stage.Published }, pipeline2, sort },
          context,
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
    },
    Mutation: {
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
                //TODO: add a way to specifiy specific fields as mandatory watchers
                //TODO: e.g. { watcherUpdates: { mandatoryWatchers: ['people.authors', 'people.editors.primary'] } }

                //TODO: remove duplicates
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
                //TODO: add a way to specify email string
                //TODO: allow inserting field values with %field%
                //TODO: e.g. { watcherUpdates: { message: str } }
                //TODO: always include note at end of email about how to unwatch a document
                //TODO: and depend on the app to explain if mandatory watcher
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
      //TODO: add built in helper for incrementing a numerical value
      //TODO: and automatically generate typeDefs and resolvers
      //TODO: that only include Float and Int fields
      //TODO: e.g. Model.findByIdAndUpdate(_id, { $inc: data }, { returnOriginal: false });
      //TODO: where data is of type { [key: string]: number }
      articleAddApplause: async (_, { _id, newClaps }, context: Context) => {
        const doc = await findDoc({ model: 'Article', _id, context, fullAccess: true });
        doc.claps += newClaps;
        return withPubSub('ARTICLE', 'MODIFIED', doc.save());
      },
    },
  });

  collection.typeDefs =
    collection.typeDefs +
    gql`
  
  type Query {    
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
    Get a set of articles with confidential information pruned. If _ids is
    omitted, the API will return all articles.
    """
    articlesPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!, featured: Boolean): Paged<PrunedArticle>
    
  }

  type Mutation {
    """
    Add claps to an article
    """
    articleAddApplause(_id: ObjectID!, newClaps: Int!): Article
  }
`;

  return collection;
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
  claps?: number;
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
export { articles, Stage as EnumArticleStage };
