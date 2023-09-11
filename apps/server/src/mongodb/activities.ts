/* eslint-disable @typescript-eslint/no-explicit-any */
import activityCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Activity';
import { genCollection } from '../graphql/helpers';
import { Collection } from '../types/config';

const activities = (tenant: string): Collection => {
  const collection = genCollection(
    {
      ...activityCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [0] },
        create: { teams: ['admin'], users: [] },
        modify: { teams: ['admin'], users: [] },
        hide: { teams: ['admin'], users: [] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        archive: { teams: [], users: [] },
        delete: { teams: ['admin'], users: [] },
        publish: { teams: ['admin'], users: [] },
        bypassDocPermissions: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

  return collection;
};

export { activities };
