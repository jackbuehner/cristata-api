import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { Collection } from '../../types/config';

/**
 * Merges preset schema fields per the config with fields from the collection config.
 */
function constructBasicSchemaFields(collection: Collection) {
  return merge(
    collectionSchemaFields,
    collection.schemaFields,
    collection.canPublish ? publishableCollectionSchemaFields : {},
    collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
  );
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
  archived: { type: Boolean, required: true, default: false },
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

export {
  constructBasicSchemaFields,
  collectionSchemaFields,
  publishableCollectionSchemaFields,
  withPermissionsCollectionSchemaFields,
};
export type {
  CollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
  PublishableCollectionSchemaFields,
  GitHubTeamNodeID,
};
