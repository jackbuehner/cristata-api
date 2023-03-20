/* eslint-disable @typescript-eslint/no-explicit-any */
import eventCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Event';
import { genCollection } from '../graphql/helpers';
import { Collection } from '../types/config';

/**
 * *CristataEvent* collection
 */
const events = (tenant: string): Collection => {
  const collection = genCollection(
    {
      ...eventCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [] },
        create: { teams: [], users: [] },
        modify: { teams: [], users: [] },
        hide: { teams: [], users: [] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        archive: { teams: [], users: [] },
        delete: { teams: ['admin'], users: [] },
        publish: { teams: [], users: [] },
        bypassDocPermissions: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

  return collection;
};

export { events };
