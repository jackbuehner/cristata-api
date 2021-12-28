import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { config } from '../config';
import './articles.model';
import './photoRequests.model';
import './photos.model';
import './settings.model';
import './shorturl.model';
import './flush.model';
import { merge } from 'merge-anything';
import { Teams, Users } from '../config/database';
import passportLocalMongoose from 'passport-local-mongoose';

// destructure connection info from config
const { username, password, host, database, options } = config.database.connection;

// connect to mongoDB
if (username && password) {
  mongoose.connect(`mongodb+srv://${username}:${password}@${host}/${database}?${options}`);
} else {
  mongoose.connect(`mongodb://127.0.0.1/${database}?${options}`);
}

type GitHubTeamNodeID = string;

interface CollectionSchemaFields {
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
  };
  people: {
    created_by?: mongoose.Types.ObjectId;
    modified_by: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
    last_modified_by?: mongoose.Types.ObjectId;
    watching: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
  };
  hidden: boolean;
  locked: boolean;
  history: Array<{
    type: string;
    user: mongoose.Types.ObjectId;
    at: string; // ISO string
  }>;
}

interface WithPermissionsCollectionSchemaFields {
  permissions: {
    teams: GitHubTeamNodeID[];
    users: mongoose.Types.ObjectId[];
  };
}

interface PublishableCollectionSchemaFields {
  timestamps: {
    published_at: string; // ISO string
    updated_at: string; // ISO string
  };
  people: {
    published_by: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
    last_published_by?: mongoose.Types.ObjectId;
  };
}

// schema fields to include in every collection
const collectionSchemaFields = {
  timestamps: {
    created_at: { type: Date, required: true, default: new Date().toISOString() },
    modified_at: { type: Date, required: true, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: mongoose.Schema.Types.ObjectId },
    modified_by: { type: [mongoose.Schema.Types.ObjectId] },
    last_modified_by: { type: mongoose.Schema.Types.ObjectId },
    watching: { type: [mongoose.Schema.Types.ObjectId] },
  },
  hidden: { type: Boolean, required: true, default: false },
  locked: { type: Boolean, required: true, default: false },
  history: [
    {
      type: { type: String, required: true },
      user: { type: mongoose.Schema.Types.ObjectId, required: true },
      at: {
        type: Date,
        required: true,
        default: new Date().toISOString(),
      },
    },
  ],
};

const publishableCollectionSchemaFields = {
  timestamps: {
    published_at: { type: Date, required: true, default: '0001-01-01T01:00:00.000+00:00' },
    updated_at: { type: Date, required: true, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    published_by: { type: [mongoose.Schema.Types.ObjectId] },
    last_published_by: { type: mongoose.Schema.Types.ObjectId },
  },
};

const withPermissionsCollectionSchemaFields = {
  permissions: {
    teams: { type: [String] },
    users: { type: [mongoose.Schema.Types.ObjectId] },
  },
};

// create the schema and model for each collection
config.database.collections.forEach((collection) => {
  // merge preset schema fields per the config with fiels from the collection config
  const basicSchemaFields = merge(
    collectionSchemaFields,
    collection.schemaFields(Users, Teams),
    collection.canPublish ? publishableCollectionSchemaFields : {},
    collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
  );

  // convert first level of nested objects into subdocuments
  const complexSchemaFields = {};
  Object.entries(basicSchemaFields).forEach(([key, value]) => {
    // if the schema value is an object of properties, convert the object into a schema
    // (check !vaue.type to ensure that it is an object instead of a complex schema def)
    // (check !vaue.paths to ensure that it is an object intead of a mongoose schema)
    // @ts-expect-error type and paths *might* be inside value
    if (Object.prototype.toString.call(value) === '[object Object]' && !value.type && !value.paths) {
      const SubSchema = new mongoose.Schema(value as { [key: string]: unknown });
      complexSchemaFields[key] = { type: SubSchema, default: () => ({}) };
    } else {
      complexSchemaFields[key] = value;
    }
  });

  // create the schema
  const Schema = new mongoose.Schema(complexSchemaFields);

  // add pagination to aggregation
  Schema.plugin(aggregatePaginate);

  // plugin passport-local-mongoose to the users collection
  if (collection.name === 'User')
    Schema.plugin(passportLocalMongoose, {
      saltlen: 36,
      iterations: 26000,
      keylen: 512,
      digestAlgorithm: 'sha256',
      interval: 100, // 0.1 seconds
      maxInterval: 30000, // 5 minutes
      usernameField: 'username',
      passwordField: 'password',
      usernameUnique: true,
      saltField: 'p_salt',
      hashField: 'p_hash',
      attemptsField: 'p_attempts',
      lastLoginField: 'p_last_login',
      selectFields: ['_id'], // fields to be provided to the serializer function
      usernameCaseInsensitive: false,
      usernameLowerCase: true,
      populateFields: undefined,
      encoding: 'hex',
      limitAttempts: false,
      usernameQueryFields: ['slug'],
    });

  // create the model based on the schema
  mongoose.model(collection.name, Schema);
});

// force a user with the name 'Unknown' and slug 'unknown-user-internal'
(async () => {
  const User = mongoose.model('User');
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
})();

export type {
  CollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
  PublishableCollectionSchemaFields,
  GitHubTeamNodeID,
};
