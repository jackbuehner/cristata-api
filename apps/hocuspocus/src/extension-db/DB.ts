import { defaultSchemaDefTypes, SchemaDefType } from '@jackbuehner/cristata-generator-schema';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import { AwarenessUser } from 'utils';

export interface CollectionDoc {
  __yState?: string;
  __yVersions?: CollectionDocVersion[];
}

export interface CollectionDocVersion {
  state: string;
  timestamp: Date;
  users: Array<AwarenessUser['user']>;
}

interface TenantDoc {
  name: string;
  config: {
    collections: Array<{
      name: string;
      canPublish?: boolean;
      withPermissions?: boolean;
      schemaDef: SchemaDefType;
      by:
        | [string, string]
        | {
            one: [string, string];
            many: [string, string];
          };
    }>;
  };
}

interface ConnectionDetails {
  username?: string;
  password?: string;
  host?: string;
  options?: string;
}

export class DB {
  connections: Record<string, mongoose.Connection> = {};
  tenants: string[] = [];

  constructor(c: ConnectionDetails) {
    this.connect(c);
  }

  async connect({ username, password, host, options }: ConnectionDetails) {
    if (!options) options = `retryWrites=true&w=majority`;

    // connect to mongoDB
    if (username && password && host) {
      await mongoose.connect(`mongodb+srv://${username}:${password}@${host}/app?${options}`);
    } else {
      await mongoose.connect(`mongodb://127.0.0.1/app?${options}`);
    }

    // get the tenants
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    this.tenants = (await tenantsCollection.find().toArray()).map((doc) => doc.name);

    // create a connections object with a connection for each tenant
    this.tenants.forEach((tenant) => {
      this.connections[tenant] = mongoose.connection.useDb(tenant, { useCache: true });
    });
  }

  collection(tenant: string, collectionName: string): mongodb.Collection<CollectionDoc> | null {
    if (!this.tenants.includes(tenant)) return null;

    const pluralCollectionName = mongoose.pluralize()?.(collectionName) || collectionName;
    return this.connections[tenant].db.collection<CollectionDoc>(pluralCollectionName);
  }

  async collectionSchema(tenant: string, collectionName: string): Promise<SchemaDefType> {
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne({ name: tenant });
    const collection = tenantConfig?.config.collections?.find((col) => col.name === collectionName);

    const schema = merge<SchemaDefType, SchemaDefType[]>(
      collection?.schemaDef || {},
      defaultSchemaDefTypes.standard,
      collection?.canPublish ? defaultSchemaDefTypes.publishable : {},
      collection?.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
    );

    return schema;
  }

  async collectionAccessor(tenant: string, collectionName: string) {
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne({ name: tenant });

    const by = tenantConfig?.config.collections?.find((col) => col.name === collectionName)?.by;
    const defaultBy = ['_id', 'ObjectId'];

    if (!by) {
      return { one: defaultBy, many: defaultBy };
    } else if (Array.isArray(by)) {
      return { one: by, many: by };
    } else {
      return by;
    }
  }
}
