import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import passport from 'passport';
import pluralize from 'pluralize';
import { Collection } from '../types/config';
import { constructCollections } from '../utils/constructCollections';
import { connectDb } from './connectDB';
import { createTextIndex } from './createTextIndex';
import { createCollectionSchema } from './helpers/createCollectionSchema';
import { injectPassportPlugin } from './helpers/injectPassportPlugin';

class TenantDB {
  collections: Collection[];
  tenant: string;
  opts?: TenantDBOptions;

  models = new Map<string, TenantModel<unknown>>();
  schemas = new Map<string, mongoose.Schema>();

  constructor(tenant: string, collections?: Collection[], opts?: TenantDBOptions) {
    this.tenant = tenant;
    this.opts = opts;

    // use the provided collections from the config
    // or use the default collections if config is undefined
    this.collections = collections || constructCollections([], tenant);
  }

  /**
   * Returns an existing connection to the tenant's database
   * or creates and returns a new connection if none exists.
   *
   * **THIS MUST BE USED BEFORE ANY DATABASE OPERATION.**
   */
  async connect() {
    const connection = await connectDb(this.tenant, this.opts?.uri);
    return connection;
  }

  /**
   * Returns a mongoose model from the collection of the provided name.
   *
   * The model will only be created once; subsequent calls with the
   * same model name will return the already created model.
   */
  async model<T>(name: string): Promise<TenantModel<T> | null> {
    // return the model if it has already been created
    if (this.models.has(name) && !this.opts?.alwaysNewModels) {
      return this.models.get(name) as TenantModel<T>;
    }

    // find the collection from the config
    const collection = this.collections.find((col) => col.name === name);

    // return null if the collection does not exist
    if (!collection) {
      return null;
    }

    // create the schema
    const Schema = createCollectionSchema(collection);

    // add pagination to aggregation
    Schema.plugin(aggregatePaginate);

    // add passport-local-mongoose to the users collection
    if (collection.name === 'User') injectPassportPlugin(Schema);

    // connect to the databse
    const connection = await this.connect();

    // delete model from mongoose connection if it already
    // exists because it was created outside the scope
    // of this class
    // (mongoose disallows duplicate models)
    if (connection.models[collection.name]) {
      connection.deleteModel(collection.name);
    }

    // create the model based on the schema
    const Model = connection.model(collection.name, Schema) as unknown as TenantModel<T>;

    // activate the passport strategy for mongoose users
    if (collection.name === 'User') {
      passport.use(
        (Model as unknown as mongoose.PassportLocalModel<mongoose.Document>).createStrategy({
          tenant: this.tenant,
        })
      );
    }

    // create text search index
    createTextIndex(collection, Schema, connection);

    // enable change stream images
    // so the previous document state can be used for comparison to the new state
    try {
      const pluralCollectionName = mongoose.pluralize()?.(collection.name) || pluralize(collection.name);
      connection.db.command({ collMod: pluralCollectionName, changeStreamPreAndPostImages: { enabled: true } });
    } catch (error) {
      console.error(error);
    }

    // save schema and model
    this.schemas.set(name, Schema);
    this.models.set(name, Model as TenantModel<unknown>);

    return Model;
  }

  async createDefaultUsers() {
    // connect to the databse
    const connection = await this.connect();

    // create the model based on the schema
    const User = connection.model('User');

    // create the unknown user if it does not exist
    const unknownUserExists = !!(await User.findOne({ name: 'Unknown', slug: 'unknown-user-internal' }));
    if (!unknownUserExists) {
      const newUser = new User({
        _id: new mongoose.Types.ObjectId('000000000000000000000000'),
        name: 'Unknown',
        slug: 'unknown-user-internal',
        hidden: true,
        locked: true,
      });
      await newUser.save();
    }

    // create the deleted user if it does not exist
    const deletedUserExists = !!(await User.findOne({ name: 'Deleted', slug: 'deleted-user-internal' }));
    if (!deletedUserExists) {
      const newUser = new User({
        _id: new mongoose.Types.ObjectId('000000000000000000000001'),
        name: 'Deleted',
        slug: 'deleted-user-internal',
        hidden: true,
        locked: true,
      });
      await newUser.save();
    }
  }
}

interface TenantDBOptions {
  uri?: string;
  alwaysNewModels?: boolean;
}

mongoose.Schema.Types.String.checkRequired((v) => v !== null && v !== undefined);

interface TenantModel<DocType> extends Omit<mongoose.Model<DocType>, 'new'> {
  new (
    doc?: Partial<DocType>,
    fields?: Record<string, unknown>,
    skipId?: boolean
  ): mongoose.HydratedDocument<DocType> & DocType;
}

export { TenantDB };
export type { TenantModel };
