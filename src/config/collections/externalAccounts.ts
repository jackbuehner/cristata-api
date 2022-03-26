import mongoose from 'mongoose';
import { genCollection } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { Collection } from '../database';

const externalAccounts = (): Collection => {
  const collection = genCollection({
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
    actionAccess: {
      get: { teams: ['admin'], users: [] },
      create: { teams: ['admin'], users: [] },
      modify: { teams: ['admin'], users: [] },
      hide: { teams: ['admin'], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: ['admin'], users: [] },
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
