import { CollectionPermissions } from '../../src/types/config';
import { Context } from '../../src/apollo';
import mongoose from 'mongoose';

interface UseApolloContext {
  isAuthenticated?: boolean;
  collection?: {
    name: string;
    withPermissions: boolean;
    actionAccess: CollectionPermissions;
  };
  isAdmin?: boolean;
}

function useApolloContext({ isAuthenticated, collection, isAdmin }: UseApolloContext): Context {
  return {
    config: {
      allowedOrigins: [],
      collections: collection
        ? [
            {
              name: collection.name,
              withPermissions: collection.withPermissions,
              actionAccess: collection.actionAccess,
              typeDefs: '',
              resolvers: {},
              schemaFields: {},
              schemaDef: {},
              generationOptions: {},
              by: ['_id', 'ObjectId'],
            },
          ]
        : [],
      connection: {
        username: '',
        password: '',
        host: '',
        database: '',
        options: '',
      },
      dashboard: { collectionRows: [] },
      defaultSender: 'Cristata <noreply@example.com>',
      minimumClientVersion: '0.0.0',
      tenantDisplayName: 'Test Tenant',
    },
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
  };
}

export { useApolloContext };
