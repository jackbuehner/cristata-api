import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const flush = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'Flush',
    canPublish: true,
    withPermissions: true,
    withSubscription: true,
    publicRules: { filter: { 'timestamps.week': { $lt: new Date() } } }, // disallow accessing future weeks
    schemaDef: {
      volume: { type: 'Number', required: true, modifiable: true, public: true, default: 99 },
      issue: { type: 'Number', required: true, modifiable: true, public: true, default: 1 },
      left_advert_photo_url: { type: 'String', modifiable: true, public: true },
      events: [
        {
          name: { type: 'String', required: true, modifiable: true, public: true, default: 'New event' },
          date: {
            type: 'Date',
            required: true,
            modifiable: true,
            public: true,
            default: '0001-01-01T01:00:00.000+00:00',
          },
          location: { type: 'String', required: true, modifiable: true, public: true, default: 'location' },
        },
      ],
      articles: {
        featured: { type: ['Article', 'ObjectId'], modifiable: true, public: true },
        more: { type: ['[Article]', ['ObjectId']], modifiable: true, public: true },
      },
      permissions: {
        teams: {
          type: ['String'],
          required: true,
          modifiable: true,
          public: true,
          default: ['000000000000000000000009'],
        },
      },
      timestamps: {
        week: {
          type: 'Date',
          required: true,
          modifiable: true,
          public: true,
          default: '0001-01-01T01:00:00.000+00:00',
        },
      },
    },
    Users,
    Teams,
    helpers,
    actionAccess: {
      get: { teams: [0], users: [] },
      create: { teams: [0], users: [] },
      modify: { teams: [0], users: [] },
      hide: { teams: [0], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      publish: { teams: ['admin'], users: [] },
      delete: { teams: ['admin'], users: [] },
    },
  });

  return collection;
};

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
export { flush };
