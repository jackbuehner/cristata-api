import { genSchemaFields } from '@jackbuehner/cristata-generator-schema';
import activityCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Activity';
import { merge } from 'merge-anything';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, SchemaDefinitionProperty } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import {
  collectionSchemaFields,
  publishableCollectionSchemaFields,
  withPermissionsCollectionSchemaFields,
} from '../../src/mongodb/helpers/constructBasicSchemaFields';
import { convertTopNestedObjectsToSubdocuments } from '../../src/mongodb/helpers/convertTopNestedObjectsToSubdocuments';

async function startMongoServer() {
  const mongoServer = await MongoMemoryServer.create({
    binary: { downloadDir: './cache/mongodb-binaries', version: '6.0.2' },
  });
  global.conn = mongoose.createConnection(mongoServer.getUri(), {});
  await global.conn.asPromise();
  return mongoServer;
}

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
    mongoServer = await startMongoServer();
  }, 20000);

  afterAll(async () => {
    global.conn?.destroy();
    if (mongoServer) await mongoServer.stop();
  });

  const createModel: CreateModel = async (
    name,
    customFields = undefined,
    withPermissions = false,
    canPublish = false
  ) => {
    if (!global.conn) mongoServer = await startMongoServer();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tenantDB = global.conn!.useDb('db_2', { useCache: true });

    // create the activity model since many of the helpers require it
    if (name !== 'Activity') createModel('Activity');

    // delete the model if it already exists
    if (tenantDB.models[name]) {
      tenantDB.deleteModel(name);
    }

    // create the schema
    const Schema = (() => {
      if (name === 'Activity') {
        const { schemaFields } = genSchemaFields(activityCollection.schemaDef);
        return new mongoose.Schema(schemaFields);
      }

      return new mongoose.Schema(
        convertTopNestedObjectsToSubdocuments(
          merge(
            collectionSchemaFields,
            withPermissions ? withPermissionsCollectionSchemaFields : {},
            canPublish ? publishableCollectionSchemaFields : {},
            customFields || {}
          )
        ) as { [path: string]: SchemaDefinitionProperty<undefined> }
      );
    })();

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
) => Promise<Model<unknown>>;

export { useMongoose };
