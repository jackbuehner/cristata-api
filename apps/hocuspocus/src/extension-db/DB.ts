import { defaultSchemaDefTypes, GenSchemaInput, SchemaDefType } from '@jackbuehner/cristata-generator-schema';
import userCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/User';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import { AwarenessUser } from 'utils';

export interface CollectionDoc {
  __yState?: string;
  __yVersions?: CollectionDocVersion[];
  __migrationBackup: never[];
  __ignoreBackup?: boolean;
  __stateExists?: boolean;
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
      options: GenSchemaInput['options'];
    }>;
    tenantDisplayName: string;
    secrets: { aws: { accessKeyId: string; secretAccessKey: string } };
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

  get readyState() {
    return mongoose.connection.readyState;
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
    if (collectionName === 'User') {
      return merge<SchemaDefType, SchemaDefType[]>(
        userCollection?.schemaDef || {},
        defaultSchemaDefTypes.standard,
        userCollection?.canPublish ? defaultSchemaDefTypes.publishable : {},
        userCollection?.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
      );
    }

    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne(
      { name: tenant },
      {
        projection: {
          'config.collections.name': 1,
          'config.collections.canPublish': 1,
          'config.collections.withPermissions': 1,
          'config.collections.schemaDef': 1,
        },
      }
    );
    const collection = tenantConfig?.config.collections?.find((col) => col.name === collectionName);

    const schema = merge<SchemaDefType, SchemaDefType[]>(
      collection?.schemaDef || {},
      defaultSchemaDefTypes.standard,
      collection?.canPublish ? defaultSchemaDefTypes.publishable : {},
      collection?.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
    );

    return schema;
  }

  async collectionOptions(tenant: string, collectionName: string): Promise<GenSchemaInput['options']> {
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne(
      { name: tenant },
      {
        projection: {
          'config.collections.name': 1,
          'config.collections.options': 1,
        },
      }
    );
    const collection = tenantConfig?.config.collections?.find((col) => col.name === collectionName);

    const options = collection?.options || {};

    return options;
  }

  async collectionAccessor(tenant: string, collectionName: string) {
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne(
      { name: tenant },
      { projection: { 'config.collections.name': 1, 'config.collections.by': 1 } }
    );

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

  async tenantEmailInfo(tenant: string): Promise<{
    tenantDisplayName: string;
    secrets?: { aws: { accessKeyId: string; secretAccessKey: string } };
  }> {
    const tenantsCollection = mongoose.connection.db.collection<TenantDoc>('tenants');
    const tenantConfig = await tenantsCollection.findOne(
      { name: tenant },
      {
        projection: {
          'config.tenantDisplayName': 1,
        },
      }
    );

    return {
      tenantDisplayName: tenantConfig?.config.tenantDisplayName || tenant,
      secrets: {
        aws: {
          accessKeyId: process.env.AWS_SECRET_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      },
    };
  }
}
