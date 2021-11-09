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

// destructure connection info from config
const { username, password, host, database, options } = config.database.connection;

// connect to mongoDB
mongoose.connect(`mongodb+srv://${username}:${password}@${host}/${database}?${options}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});

type GitHubTeamNodeID = string;
type GitHubUserID = number;

interface CollectionSchemaFields {
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by: GitHubUserID[]; // mongoose always returns at least an empty array
    last_modified_by?: GitHubUserID;
    watching: GitHubUserID[]; // mongoose always returns at least an empty array
  };
  hidden: boolean;
  locked: boolean;
  history: Array<{
    type: string;
    user: GitHubUserID;
    at: string; // ISO string
  }>;
}

interface WithPermissionsCollectionSchemaFields {
  permissions: {
    teams: GitHubTeamNodeID[];
    users: GitHubUserID[];
  };
}

interface PublishableCollectionSchemaFields {
  timestamps: {
    published_at: string; // ISO string
    updated_at: string; // ISO string
  };
  people: {
    published_by: GitHubUserID[]; // mongoose always returns at least an empty array
    last_published_by?: GitHubUserID;
  };
}

// schema fields to include in every collection
const collectionSchemaFields = {
  timestamps: {
    created_at: { type: Date, required: true, default: new Date().toISOString() },
    modified_at: { type: Date, required: true, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
    watching: { type: [Number] },
  },
  hidden: { type: Boolean, required: true, default: false },
  locked: { type: Boolean, required: true, default: false },
  history: [
    {
      type: { type: String, required: true },
      user: { type: Number, required: true },
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
    published_by: { type: [Number] },
    last_published_by: { type: Number },
  },
};

const withPermissionsCollectionSchemaFields = {
  permissions: {
    teams: { type: [String] },
    users: { type: [Number] },
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
      complexSchemaFields[key] = SubSchema;
    } else {
      complexSchemaFields[key] = value;
    }
  });

  // create the schema
  const Schema = new mongoose.Schema(complexSchemaFields);

  // add pagination to aggregation
  Schema.plugin(aggregatePaginate);

  // create the model based on the schema
  mongoose.model(collection.name, Schema);
});

export type {
  CollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
  PublishableCollectionSchemaFields,
  GitHubUserID,
  GitHubTeamNodeID,
};
