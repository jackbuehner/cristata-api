import mongoose from 'mongoose';
import { DB } from './DB';

export function TenantModel(tenantDb: DB, tenant: string) {
  return async (collectionName: string) => {
    if (tenantDb.connections[tenant].modelNames().includes(collectionName)) {
      return tenantDb.connections[tenant].model(collectionName);
    }
    return tenantDb.connections[tenant].model<unknown>(
      collectionName,
      new mongoose.Schema({}, { strict: false })
    );
  };
}
