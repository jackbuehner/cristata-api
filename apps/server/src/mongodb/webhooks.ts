/* eslint-disable @typescript-eslint/no-explicit-any */
import webhookCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Webhook';
import { genCollection } from '../graphql/helpers';
import { Collection } from '../types/config';

/**
 * *CristataWebhook* collection
 */
const webhooks = (tenant: string): Collection => {
  const collection = genCollection(
    {
      ...webhookCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [] },
        create: { teams: ['admin'], users: [] },
        modify: { teams: ['admin'], users: [] },
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

export { webhooks };
