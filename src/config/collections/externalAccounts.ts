import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const externalAccounts = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'ExternalAccount',
    canPublish: false,
    withPermissions: true,
    withSubscription: false,
    publicRules: false,
    schemaDef: {
      service_url: { type: 'String', required: true, modifiable: true },
      username: { type: 'String', required: true, modifiable: true },
      password: { type: 'String', required: true, modifiable: true },
      otp_hash: { type: 'String', modifiable: true },
    },
    by: { one: ['code', 'String'], many: ['_id', 'ObjectId'] },
    Users,
    Teams,
    helpers,
    actionAccess: {
      get: { teams: [Teams.ADMIN], users: [] },
      create: { teams: [Teams.ADMIN], users: [] },
      modify: { teams: [Teams.ADMIN], users: [] },
      hide: { teams: [Teams.ADMIN], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    },
  });

  return collection;
};

interface IExternalAccount extends CollectionSchemaFields {
  service_url: string;
  username: string;
  password: string;
  otp_hash?: string;
}

interface IExternalAccountDoc extends IExternalAccount, mongoose.Document {}

export type { IExternalAccount, IExternalAccountDoc };
export { externalAccounts };
