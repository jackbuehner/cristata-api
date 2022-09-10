import { CollectionPermissions, Configuration } from '../../src/types/config';
import { Context } from '../../src/graphql/server';
import mongoose from 'mongoose';
import { GenCollectionInput } from '../../src/graphql/helpers/generators/genCollection';
import Cristata from '../../src/Cristata';

interface UseApolloContext {
  isAuthenticated?: boolean;
  collection: {
    name: string;
    canPublish?: boolean;
    withPermissions: boolean;
    actionAccess: CollectionPermissions;
  };
  isAdmin?: boolean;
}

function useApolloContext({ isAuthenticated, collection, isAdmin }: UseApolloContext): Context {
  const config: Configuration = {
    collections: collection
      ? [
          {
            name: collection.name,
            withPermissions: collection.withPermissions,
            actionAccess: collection.actionAccess,
            canPublish: collection.canPublish,
            typeDefs: '',
            resolvers: {},
            schemaFields: {},
            schemaDef: {},
            generationOptions: {},
            by: ['_id', 'ObjectId'],
            raw: {} as GenCollectionInput,
            textIndexFieldNames: [],
            singleDocument: false,
          },
        ]
      : [],
    dashboard: { collectionRows: [] },
    defaultSender: 'Cristata <noreply@example.com>',
    minimumClientVersion: '0.0.0',
    tenantDisplayName: 'Test Tenant',
    secrets: {
      aws: { accessKeyId: '', secretAccessKey: '' },
      fathom: { dashboardPassword: '', siteId: '' },
    },
    navigation: {
      main: [],
      sub: [] as unknown as Configuration['navigation']['sub'],
    },
  };

  return {
    config: config,
    isAuthenticated: !!isAuthenticated,
    profile: isAuthenticated
      ? {
          provider: 'local',
          _id: new mongoose.Types.ObjectId('000000000000000000000001'),
          name: 'Test User',
          username: 'test-user',
          email: 'test@example.com',
          teams: isAdmin
            ? ['000000000000000000000001', '000000000000000000000099']
            : ['000000000000000000000099'],
          two_factor_authentication: false,
          next_step: undefined,
          methods: ['local'],
          tenant: 'db_2',
        }
      : undefined,
    tenant: 'db_2',
    cristata: {} as unknown as Cristata,
    restartApollo: async () => {
      return;
    },
  };
}

export { useApolloContext };
