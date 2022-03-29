import mongoose, { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  collectionSchemaFields,
  convertTopNestedObjectsToSubdocuments,
  withPermissionsCollectionSchemaFields,
} from '../../src/mongodb/db';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { SchemaDefinitionProperty } from 'mongoose';

/**
 * Create a MongoDB server in memory for tests and connect
 * mongoose to the in-memory MongoDB server.
 *
 * The server and connection is created before each test
 * and destroyed after each test.
 */
function useMongoose(): {
  mongoose: typeof mongoose;
  mongoServer: MongoMemoryServer;
  createModel: CreateModel;
} {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  const createModel: CreateModel = (name, customFields = undefined, withPermissions = false) => {
    // delete the model if it already exists
    delete mongoose.models[name];

    // create the schema
    const Schema = new mongoose.Schema(
      convertTopNestedObjectsToSubdocuments({
        ...collectionSchemaFields,
        ...(withPermissions ? withPermissionsCollectionSchemaFields : {}),
        ...(customFields || {}),
      })
    );

    // enable pagination on aggregation
    Schema.plugin(aggregatePaginate);

    // create the model
    mongoose.model(name, Schema);

    // return the model
    return mongoose.model(name);
  };

  return { mongoose, mongoServer, createModel };
}

type CreateModel = (
  name: string,
  customFields?: Record<string, SchemaDefinitionProperty>,
  withPermissions?: boolean
) => Model<unknown>;

export { useMongoose };