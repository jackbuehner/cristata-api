import { DB } from './DB';
import mongoose from 'mongoose';

export function TenantModel(tenantDb: DB, tenant: string) {
  return async (collectionName: string) => {
    if (tenantDb.connections[tenant].modelNames().includes(collectionName)) {
      return tenantDb.connections[tenant].model(collectionName);
    }
    return tenantDb.connections[tenant].model(collectionName, new mongoose.Schema({}, { strict: false }));
  };
}
