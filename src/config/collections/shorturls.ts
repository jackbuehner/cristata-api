import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const shorturls = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'ShortURL',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      original_url: { type: String, required: true, modifiable: true },
      code: {
        type: String,
        required: true,
        modifiable: true,
        unique: true,
        default: { code: 'alphanumeric', length: 7 },
        rule: {
          match: /^[a-z0-9]+$/i,
          message: 'shorturl code must be alphanumeric',
        },
      },
      domain: { type: String, required: true, modifiable: true, default: 'flusher.page' },
    },
    by: { one: ['code', mongoose.Schema.Types.String], many: ['_id', mongoose.Schema.Types.ObjectId] },
    Users,
    Teams,
    helpers,
    actionAccess: {
      get: { teams: [Teams.ANY], users: [] },
      create: { teams: [Teams.SHORTURL], users: [] },
      modify: { teams: [Teams.SHORTURL], users: [] },
      hide: { teams: [Teams.SHORTURL], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
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
