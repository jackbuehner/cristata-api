import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import { Context } from '../../apollo';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import { UsersType, TeamsType } from '../../types/config';
import { dateAtTimeZero } from '../../utils/dateAtTimeZero';
import { slugify } from '../../utils/slugify';
import { Collection } from '../database';

const satire = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const { modifyDoc, withPubSub, findDoc, findDocAndPrune } = helpers;

  const collection = helpers.generators.genCollection({
    name: 'Satire',
    canPublish: true,
    withPermissions: true,
    withSubscription: true,
    publicRules: { filter: { stage: Stage.PUBLISHED }, slugDateField: 'timestamps.published_at' },
    schemaDef: {
      name: { type: String, required: true, modifiable: true, public: true, default: 'New Satire' },
      slug: { type: String, modifiable: true, public: true },
      stage: { type: mongoose.Schema.Types.Decimal128, modifiable: true, default: Stage.PLANNING },
      tags: { type: [String], modifiable: true, public: true, default: [] },
      description: { type: String, required: true, modifiable: true, public: true, default: '' },
      photo_path: { type: String, required: true, modifiable: true, public: true, default: '' },
      photo_credit: { type: String, required: true, modifiable: true, public: true, default: '' }, // ref: { model: 'Photo', by: 'photo_url', path: '$doc.people.display_authors' }
      photo_caption: { type: String, required: true, modifiable: true, public: true, default: '' },
      body: { type: String, modifiable: true, public: true },
      legacy_html: { type: Boolean, required: true, modifiable: true, public: true, default: false },
      people: {
        authors: {
          type: ['[User]', [mongoose.Schema.Types.ObjectId]],
          required: true,
          modifiable: true,
          default: [],
        },
        display_authors: { type: [String], required: true, modifiable: true, public: true, default: [] },
        editors: {
          primary: {
            type: ['[User]', [mongoose.Schema.Types.ObjectId]],
            required: true,
            modifiable: true,
            default: [],
          },
          copy: {
            type: ['[User]', [mongoose.Schema.Types.ObjectId]],
            required: true,
            modifiable: true,
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
    },
    Users,
    Teams,
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
      satireBySlugPublic: async (_, args, context: Context) => {
        // create filter to find newest article with matching slug
        const filter = args.date
          ? {
              'timestamps.published_at': {
                $gte: dateAtTimeZero(args.date),
                $lt: new Date(dateAtTimeZero(args.date).getTime() + 24 * 60 * 60 * 1000),
              },
              stage: Stage.PUBLISHED,
            }
          : {
              stage: Stage.PUBLISHED,
            };

        // get the satire
        const prunedSatire = await findDocAndPrune({
          model: 'Satire',
          by: 'slug',
          _id: args.slug,
          filter: filter,
          context,
          keep: [
            '_id',
            'timestamps.published_at',
            'timestamps.updated_at',
            'people.display_authors',
            'name',
            'tags',
            'description',
            'photo_path',
            'photo_credit',
            'photo_caption',
            'legacy_html',
            'body',
            'slug',
          ],
          fullAccess: true,
        });

        // add photo credit
        const constructedPrunedSatire = {
          ...prunedSatire,
          photo_credit: JSON.parse(
            JSON.stringify(
              await findDoc({
                model: 'Photo',
                by: 'photo_url',
                //@ts-expect-error photo_path exists on prunedSatire
                _id: prunedSatire.photo_path,
                context,
                fullAccess: true,
              })
            )
          )?.people?.photo_created_by,
        };

        // return the article
        return constructedPrunedSatire;
      },
    },
    Mutation: {
      satireModify: (_, { _id, input }, context: Context) =>
        withPubSub(
          'SATIRE',
          'MODIFIED',
          modifyDoc({
            model: 'Satire',
            data: { ...input, _id },
            context,
            modify: async (currentDoc: ISatire, data: Partial<ISatire>) => {
              // set the slug if the document is being published and does not already have one
              if (data.stage === Stage.PUBLISHED && (!data.slug || !currentDoc.slug)) {
                data.slug = slugify(input.name || currentDoc.name);
              }
            },
          })
        ),
    },
  });

  return collection;
};

const Stage = {
  PLANNING: new mongoose.Types.Decimal128('1.1'),
  DRAFT: new mongoose.Types.Decimal128('2.1'),
  PENDING_EDIT: new mongoose.Types.Decimal128('3.4'),
  PENDING_UPLOAD: new mongoose.Types.Decimal128('4.1'),
  UPLOADED: new mongoose.Types.Decimal128('5.1'),
  PUBLISHED: new mongoose.Types.Decimal128('5.2'),
};

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
