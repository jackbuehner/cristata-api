import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import type { Collection } from '../database';

const satire = (helpers: Helpers): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'Satire',
    canPublish: true,
    withPermissions: true,
    withSubscription: true,
    publicRules: { filter: { stage: Stage.PUBLISHED }, slugDateField: 'timestamps.published_at' },
    schemaDef: {
      name: { type: 'String', required: true, modifiable: true, public: true, default: 'New Satire' },
      slug: {
        type: 'String',
        modifiable: true,
        public: true,
        setter: {
          condition: { $and: [{ stage: { $eq: 5.2 } }, { slug: { $exists: false } }] },
          value: { slugify: 'name' },
        },
      },
      stage: { type: 'Float', modifiable: true, default: Stage.PLANNING.toString() },
      tags: { type: ['String'], modifiable: true, public: true, default: [] },
      description: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      photo_path: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      photo_credit: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      // photo_credit: {
      //   model: 'Photo',
      //   by: 'photo_url',
      //   matches: 'photo_path',
      //   field: 'people.photo_created_by',
      //   fieldType: String,
      //   public: true,
      // },
      photo_caption: { type: 'String', required: true, modifiable: true, public: true, default: '' },
      body: { type: 'String', modifiable: true, public: true },
      legacy_html: { type: 'Boolean', required: true, modifiable: true, public: true, default: false },
      people: {
        authors: {
          type: ['[User]', ['ObjectId']],
          required: true,
          modifiable: true,
          default: [],
        },
        display_authors: { type: ['String'], required: true, modifiable: true, public: true, default: [] },
        editors: {
          primary: {
            type: ['[User]', ['ObjectId']],
            required: true,
            modifiable: true,
            default: [],
          },
          copy: {
            type: ['[User]', ['ObjectId']],
            required: true,
            modifiable: true,
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
    },
    helpers,
    customQueries: [
      {
        name: 'stageCounts',
        description: 'Get the number of satires in each stage.',
        returns: `[{ _id: Float!, count: Int! }]`,
        // @ts-expect-error bug in mongoose: https://github.com/Automattic/mongoose/issues/11059
        pipeline: [{ $group: { _id: '$stage', count: { $sum: 1 } } }],
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
  });

  return collection;
};

enum Stage {
  PLANNING = 1.1,
  DRAFT = 2.1,
  PENDING_EDIT = 3.4,
  PENDING_UPLOAD = 4.1,
  UPLOADED = 5.1,
  PUBLISHED = 5.2,
}

interface ISatire
  extends CollectionSchemaFields,
    PublishableCollectionSchemaFields,
    WithPermissionsCollectionSchemaFields {
  name: string;
  slug: string;
  timestamps: ISatireTimestamps &
    CollectionSchemaFields['timestamps'] &
    PublishableCollectionSchemaFields['timestamps'];
  people: ISatirePeople & CollectionSchemaFields['people'] & PublishableCollectionSchemaFields['people'];
  stage: mongoose.Types.Decimal128;
  tags: string[];
  description: string;
  photo_path: string;
  photo_credit: string;
  photo_caption: string;
  body?: string;
  versions?: ISatire[]; // store previous versions of the satire profile (only via v2 api)
  legacy_html: boolean; // true if it is html from the old webflow
}

interface ISatireTimestamps {
  target_publish_at?: string; // ISO string
}

interface ISatirePeople {
  authors: mongoose.Types.ObjectId[];
  display_authors: string[];
  editors: {
    primary: mongoose.Types.ObjectId[];
    copy: mongoose.Types.ObjectId[];
  };
}

interface ISatireDoc extends ISatire, mongoose.Document {}

export type { ISatire, ISatireDoc };
export { satire, Stage as EnumSatireStage };
