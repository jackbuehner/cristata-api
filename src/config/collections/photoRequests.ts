import type { Collection } from '../database';
import { genCollection } from '../../api/v3/helpers';

const photoRequests = (): Collection => {
  const collection = genCollection({
    name: 'PhotoRequest',
    canPublish: false,
    withPermissions: true,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: 'String', required: true, modifiable: true },
      stage: { type: 'Float', modifiable: true, default: Stage.NEW },
      article_id: { type: 'ObjectId', modifiable: true },
      people: {
        requested_by: { type: ['User', 'ObjectId'], modifiable: true },
      },
      permissions: {
        teams: { type: ['String'], modifiable: true, default: ['000000000000000000000003'] },
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

enum Stage {
  NEW = 1.1,
  IN_PROGRESS = 2.1,
  FULFILLED = 3.1,
}

export { photoRequests };
