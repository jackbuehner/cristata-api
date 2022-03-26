import { genCollection } from '../../api/v3/helpers';
import type { Collection } from '../database';

const articles = (): Collection => {
  const collection = genCollection({
    name: 'Article',
    canPublish: true,
    withPermissions: true,
    withSubscription: true,
    publicRules: { filter: { stage: Stage.Published }, slugDateField: 'timestamps.published_at' },
    schemaDef: {
      name: { type: 'String', required: true, modifiable: true, public: true, default: 'New Article' },
      slug: {
        type: 'String',
        modifiable: true,
        public: true,
        setter: {
          condition: { $and: [{ stage: { $eq: Stage.Published } }, { slug: { $exists: false } }] },
          value: { slugify: 'name' },
        },
      },
      stage: { type: 'Float', modifiable: true, default: Stage.Planning },
      categories: { type: ['String'], modifiable: true, public: true, default: [] },
      tags: { type: ['String'], modifiable: true, public: true, default: [] },
      description: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      photo_path: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      video_path: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      video_replaces_photo: { type: 'Boolean', required: true, modifiable: true, public: true, default: false },
      photo_credit: {
        model: 'Photo',
        by: 'photo_url',
        matches: 'photo_path',
        field: 'people.photo_created_by',
        fieldType: 'String',
        public: true,
      },
      photo_caption: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      body: { type: 'String', modifiable: true, public: true },
      legacy_html: { type: 'Boolean', required: true, modifiable: true, public: true, default: false },
      show_comments: { type: 'Boolean', required: true, modifiable: true, public: true, default: false },
      layout: { type: 'String', required: true, modifiable: true, public: true, default: 'standard' },
      template: { type: 'String', required: true, modifiable: true, public: true, default: 'jackbuehner2020' },
      claps: { type: 'Number', modifiable: true, public: true, default: 0 },
      people: {
        authors: {
          type: ['[User]', ['ObjectId']],
          required: true,
          modifiable: true,
          public: true,
          default: [],
        },
        editors: {
          primary: {
            type: ['[User]', ['ObjectId']],
            required: true,
            modifiable: true,
            public: true,
            default: [],
          },
          copy: {
            type: ['[User]', ['ObjectId']],
            required: true,
            modifiable: true,
            public: true,
            default: [],
          },
        },
      },
      timestamps: {
        target_publish_at: { type: 'Date', modifiable: true, default: '0001-01-01T01:00:00.000+00:00' },
      },
      permissions: {
        teams: {
          type: ['String'],
          default: ['000000000000000000000003', '000000000000000000000004'],
          required: true,
        },
      },
      legacy_comments: [
        {
          author_name: { type: 'String', modifiable: false, public: true },
          commented_at: { type: 'Date', modifiable: false, public: true },
          content: { type: 'String', modifiable: false, public: true },
        },
      ],
    },
    customQueries: [
      {
        name: 'stageCounts',
        description: 'Get the number of articles in each stage.',
        returns: `[{ _id: Float!, count: Int! }]`,
        // @ts-expect-error bug in mongoose: https://github.com/Automattic/mongoose/issues/11059
        pipeline: [{ $group: { _id: '$stage', count: { $sum: 1 } } }],
      },
      {
        name: 'featuredDocs',
        description: 'Get the featured articles.',
        public: true,
        returns: '[PrunedArticle]',
        pipeline: [
          { $group: { _id: null } },
          {
            $lookup: {
              from: 'settings',
              pipeline: [
                { $match: { name: 'featured-articles' } },
                {
                  $project: {
                    _id: null,
                    articles: ['$setting.first', '$setting.second', '$setting.third', '$setting.fourth'],
                  },
                },
                { $unwind: { path: '$articles' } },
                { $lookup: { from: 'articles', localField: 'articles', foreignField: '_id', as: 'article' } },
                { $unwind: { path: '$article' } },
                { $replaceRoot: { newRoot: '$article' } },
              ],
              as: 'featuredArticles',
            },
          },
          { $unwind: { path: '$featuredArticles' } },
          { $replaceRoot: { newRoot: '$featuredArticles' } },
        ],
      },
      {
        name: 'categories',
        description: `Get the unique categories used in the articles collection.
          Uppercase letters are replaced by lowercase letters and spaces are replaced by hyphens.`,
        public: true,
        returns: '[String]!',
        pipeline: [
          { $project: { _id: null, categories: 1 } },
          { $unwind: { path: '$categories' } },
          { $project: { category: { $toLower: '$categories' } } },
          { $project: { category: { $replaceAll: { input: '$category', find: ' ', replacement: '-' } } } },
          { $group: { _id: null, categories: { $addToSet: '$category' } } },
        ],
        path: '0.categories',
      },
      {
        name: 'tags',
        description: `Get the unique tags used in the articles collection.
          Uppercase letters are replaced by lowercase letters and spaces are replaced by hyphens.`,
        public: true,
        returns: '[String]!',
        pipeline: [
          { $project: { _id: null, tags: 1 } },
          { $unwind: { path: '$tags' } },
          { $project: { tag: { $toLower: '$tags' } } },
          { $project: { tag: { $replaceAll: { input: '$tag', find: ' ', replacement: '-' } } } },
          { $group: { _id: null, tags: { $addToSet: '$tag' } } },
        ],
        path: '0.tags',
      },
    ],
    customMutations: [
      {
        name: 'addApplause',
        description: 'Increments the claps key for an article.',
        public: true,
        action: { inc: ['claps', 'Int'] },
      },
    ],
    actionAccess: {
      get: { teams: [0], users: [] },
      create: { teams: [0], users: [] },
      modify: { teams: [0], users: [] },
      hide: { teams: [0], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      publish: { teams: ['admin'], users: [] },
      delete: { teams: ['admin'], users: [] },
      bypassDocPermissions: { teams: ['managing-editors'], users: [] },
    },
    options: {
      mandatoryWatchers: ['people.authors', 'people.editors.primary'],
      watcherNotices: {
        subjectField: 'name',
        stageField: 'stage',
        stageMap: {
          1.1: 'Planning',
          2.1: 'Draft',
          3.1: 'Editor Review',
          3.2: 'Writer Revision',
          3.3: 'Copy Edit',
          3.5: 'Final Check',
          4.1: 'Pending Approval',
          5.2: 'Published',
        },
        fields: [{ name: 'name', label: 'Headline' }],
      },
    },
  });

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

export { articles };
