import { genCollection } from '../../api/v3/helpers';
import type { Collection } from '../database';

const flush = (): Collection => {
  const collection = genCollection({
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

export { flush };
