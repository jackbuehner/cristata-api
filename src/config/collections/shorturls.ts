import mongoose from 'mongoose';
import { genCollection } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { Collection } from '../database';

const shorturls = (): Collection => {
  const collection = genCollection({
    name: 'ShortURL',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      original_url: { type: 'String', required: true, modifiable: true },
      code: {
        type: 'String',
        required: true,
        modifiable: true,
        unique: true,
        default: { code: 'alphanumeric', length: 7 },
        rule: {
          match: /^[a-z0-9]+$/i,
          message: 'shorturl code must be alphanumeric',
        },
      },
      domain: { type: 'String', required: true, modifiable: true, default: 'flusher.page' },
    },
    by: { one: ['code', 'String'], many: ['_id', 'ObjectId'] },
    actionAccess: {
      get: { teams: [0], users: [] },
      create: { teams: ['shorturl'], users: [] },
      modify: { teams: ['shorturl'], users: [] },
      hide: { teams: ['shorturl'], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      delete: { teams: ['admin'], users: [] },
    },
  });

  return collection;
};

interface IShortURL extends CollectionSchemaFields {
  original_url: string;
  code: string;
  domain: string;
}

interface IShortURLDoc extends IShortURL, mongoose.Document {}

export type { IShortURL, IShortURLDoc };
export { shorturls };
