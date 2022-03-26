import { genCollection } from '../../api/v3/helpers';
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

export { externalAccounts };
