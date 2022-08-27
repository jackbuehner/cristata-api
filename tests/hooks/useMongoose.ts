import mongoose, { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  collectionSchemaFields,
  publishableCollectionSchemaFields,
  withPermissionsCollectionSchemaFields,
} from '../../src/api/mongodb/helpers/constructBasicSchemaFields';
import { convertTopNestedObjectsToSubdocuments } from '../../src/api/mongodb/helpers/convertTopNestedObjectsToSubdocuments';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { SchemaDefinitionProperty } from 'mongoose';
import { merge } from 'merge-anything';

/**
 * Create a MongoDB server in memory for tests and connect
 * mongoose to the in-memory MongoDB server.
 *
 * The server and connection is created before each test
 * and destroyed after each test.
 */
function useMongoose(): {
  mongoose: typeof mongoose;
  mongoServer: MongoMemoryServer | undefined;
  createModel: CreateModel;
} {
  let mongoServer: MongoMemoryServer | undefined = undefined;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ binary: { downloadDir: './cache/mongodb-binaries' } });
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  jest.setTimeout(10000);

  const createModel: CreateModel = (
    name,
    customFields = undefined,
    withPermissions = false,
    canPublish = false
  ) => {
    const tenantDB = mongoose.connection.useDb('db_2', { useCache: true });

    // delete the model if it already exists
    delete tenantDB.models[name];

    // create the schema
    const Schema = new mongoose.Schema(
      convertTopNestedObjectsToSubdocuments(
        merge(
          collectionSchemaFields,
          withPermissions ? withPermissionsCollectionSchemaFields : {},
          canPublish ? publishableCollectionSchemaFields : {},
          customFields || {}
        )
      ) as { [path: string]: SchemaDefinitionProperty<undefined> }
    );

    // enable pagination on aggregation
    Schema.plugin(aggregatePaginate);

    // create the model
    tenantDB.model(name, Schema);

    // return the model
    return tenantDB.model(name);
  };

  return { mongoose, mongoServer, createModel };
}

type CreateModel = (
  name: string,
  customFields?: Record<string, SchemaDefinitionProperty>,
  withPermissions?: boolean,
  canPublish?: boolean
) => Model<unknown>;

export { useMongoose };
