import mongoose from 'mongoose';
import type { CollectionDoc, Helpers } from '../../api/v3/helpers';
import { Context, publishableCollectionPeopleResolvers, pubsub } from '../../apollo';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import { dateAtTimeZero } from '../../utils/dateAtTimeZero';
import { slugify } from '../../utils/slugify';
import { Collection, Teams } from '../database';

const satire = (helpers: Helpers): Collection => {
  const {
    createDoc,
    deleteDoc,
    findDoc,
    findDocAndPrune,
    findDocs,
    getCollectionActionAccess,
    getUsers,
    gql,
    hideDoc,
    lockDoc,
    modifyDoc,
    publishDoc,
    watchDoc,
    withPubSub,
  } = helpers;

  return {
    name: 'Satire',
    canPublish: true,
    withPermissions: true,
    typeDefs: gql`
      type Satire inherits PublishableCollection, WithPermissions {
        name: String!
        slug: String
        stage: Float
        tags: [String]
        description: String!
        photo_path: String!
        photo_credit: String!
        photo_caption: String!
        body: String
        legacy_html: Boolean!
        people: SatirePeople
        timestamps: SatireTimestamps
      }
  
      type SatirePeople inherits PublishableCollectionPeople {
        authors: [User]!
        display_authors: [String]!
        editors: SatireEditors!
      }
  
      type SatireEditors {
        primary: [User]!
        copy: [User]!
      }
  
      type SatireTimestamps inherits PublishableCollectionTimestamps {
        target_publish_at: Date
      }
  
      type PrunedSatire {
        _id: ObjectID!
        name: String!
        slug: String
        tags: [String]!
        description: String!
        photo_path: String!
        photo_credit: String!
        photo_caption: String!
        body: String
        legacy_html: Boolean!
        people: PrunedSatirePeople
        timestamps: PrunedSatireTimestamps
      }
  
      type PrunedSatirePeople {
        display_authors: [String]!
      }
  
      type PrunedSatireTimestamps {
        published_at: Date!
        updated_at: Date!
      }
  
      input SatireModifyInput inherits WithPermissionsInput {
        name: String
        slug: String
        stage: Float
        tags: [String]
        description: String
        photo_path: String
        photo_credit: String
        photo_caption: String
        body: String
        legacy_html: Boolean
        people: SatireModifyInputPeople
        timestamps: SatireModifyInputTimestamps
      }
  
      input SatireModifyInputPeople {
        authors: [ObjectID]
        display_authors: [String]
        editors: SatireModifyInputPeopleEditors
      }
  
      input SatireModifyInputPeopleEditors {
        primary: [ObjectID]
        copy: [ObjectID]
      }
  
      input SatireModifyInputTimestamps {
        target_publish_at: Date
      }
  
      type Query {
        """
        Get a satire by _id.
        """
        satire(_id: ObjectID!): Satire
        """
        Get a satire by _id with confidential information pruned.
        """
        satirePublic(_id: ObjectID!): PrunedSatire
        """
        Get a satire by slug with confidential information pruned.
  
        Provide the date of the article to ensure that the correct article is provided
        (in case the slug is not unique).
        """
        satireBySlugPublic(slug: String!, date: Date): PrunedSatire
        """
        Get a set of satires. If _ids is omitted, the API will return all satires.
        """
        satires(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Satire>
        """
        Get a set of satires with confidential information pruned. If _ids is
        omitted, the API will return all satires.
        """
        satiresPublic(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<PrunedSatire>
        """
        Get the permissions of the currently authenticated user for this
        collection.
        """
        satireActionAccess: CollectionActionAccess
        """
        Get the number of articles in each stage.
        """
        satireStageCounts: [StageCount]
      }
  
      type Mutation {
        """
        Create a new satire.
        """
        satireCreate(name: String!): Satire
        """
        Modify an existing satire.
        """
        satireModify(_id: ObjectID!, input: SatireModifyInput!): Satire
        """
        Toggle whether the hidden property is set to true for an existing satire.
        This mutation sets hidden: true by default.
        Hidden satires should not be presented to clients; this should be used as
        a deletion that retains the data in case it is needed later.
        """
        satireHide(_id: ObjectID!, hide: Boolean): Satire
        """
        Toggle whether the locked property is set to true for an existing satire.
        This mutation sets locked: true by default.
        Locked satires should only be editable by the server and by admins.
        """
        satireLock(_id: ObjectID!, lock: Boolean): Satire
        """
        Add a watcher to a satire.
        This mutation adds the watcher by default.
        This mutation will use the signed in satire if watcher is not defined.
        """
        satireWatch(_id: ObjectID!, watcher: ObjectID, watch: Boolean): Satire
        """
        Deletes a satire account.
        """
        satireDelete(_id: ObjectID!): Void
        """
        Publishes an existing satire.
        """
        satirePublish(_id: ObjectID!, published_at: Date, publish: Boolean): Satire
      }
  
      extend type Subscription {
        """
        Sends satire documents when they are created.
        """
        satireCreated(): Satire
        """
        Sends the updated satire document when it changes.
        If _id is omitted, the server will send changes for all satires.
        """
        satireModified(_id: ObjectID): Satire
        """
        Sends satire _id when it is deleted.
        If _id is omitted, the server will send _ids for all deleted satires.
        """
        satireDeleted(_id: ObjectID): Satire
      }
    `,
    resolvers: {
      Query: {
        satire: (_, args, context: Context) =>
          findDoc({
            model: 'Satire',
            _id: args._id,
            context,
            accessRule: context.profile.teams.includes(Teams.MANAGING_EDITOR) ? {} : undefined,
          }),
        satirePublic: (_, args, context: Context) =>
          findDocAndPrune({
            model: 'Satire',
            _id: args._id,
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
          }),
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
        satires: (_, args, context: Context) =>
          findDocs({
            model: 'Satire',
            args,
            context,
            accessRule: context.profile.teams.includes(Teams.MANAGING_EDITOR) ? {} : undefined,
          }),
        satiresPublic: (_, args, context: Context) =>
          findDocs({ model: 'Satire', args, context, fullAccess: true }),
        satireActionAccess: (_, __, context: Context) =>
          getCollectionActionAccess({ model: 'Satire', context }),
        satireStageCounts: async () => {
          const Model = mongoose.model<CollectionDoc>('Satire');
          // @ts-expect-error bug in mongoose: https://github.com/Automattic/mongoose/issues/11059
          return await Model.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]);
        },
      },
      Mutation: {
        satireCreate: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'CREATED', createDoc({ model: 'Satire', args, context, withPermissions: true })),
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
        satireHide: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'MODIFIED', hideDoc({ model: 'Satire', args, context })),
        satireLock: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'MODIFIED', lockDoc({ model: 'Satire', args, context })),
        satireWatch: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'MODIFIED', watchDoc({ model: 'Satire', args, context })),
        satireDelete: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'DELETED', deleteDoc({ model: 'Satire', args, context })),
        satirePublish: async (_, args, context: Context) =>
          withPubSub('SATIRE', 'DELETED', publishDoc({ model: 'Satire', args, context })),
      },
      SatirePeople: {
        ...publishableCollectionPeopleResolvers,
        authors: ({ authors }) => getUsers(authors),
      },
      SatireEditors: {
        primary: ({ primary }) => getUsers(primary),
        copy: ({ copy }) => getUsers(copy),
      },
      Subscription: {
        satireCreated: { subscribe: () => pubsub.asyncIterator(['SATIRE_CREATED']) },
        satireModified: { subscribe: () => pubsub.asyncIterator(['SATIRE_MODIFIED']) },
        satireDeleted: { subscribe: () => pubsub.asyncIterator(['SATIRE_DELETED']) },
      },
    },
    schemaFields: (Users, Teams) => ({
      name: { type: String, required: true, default: 'New Satire' },
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
        display_authors: { type: [String], default: [] },
        editors: {
          primary: { type: [mongoose.Schema.Types.ObjectId] },
          copy: { type: [mongoose.Schema.Types.ObjectId] },
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
    actionAccess: (Users, Teams) => ({
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
  stage: Stage;
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
