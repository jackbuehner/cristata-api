import { defaultSchemaDefTypes, genSchemaFields } from '@jackbuehner/cristata-generator-schema';
import { mergeAndConcat } from 'merge-anything';
import mongoose from 'mongoose';
import { Collection } from '../../types/config';

/**
 * Merges preset schema fields per the config with fields from the collection config.
 */
function constructBasicSchemaFields(collection: Collection) {
  return mergeAndConcat(
    collectionSchemaFields,
    collection.schemaFields,
    collection.canPublish ? publishableCollectionSchemaFields : {},
    collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
  );
}

// schema fields to include in every collection
const { schemaFields: collectionSchemaFields } = genSchemaFields(defaultSchemaDefTypes.standard);
const { schemaFields: publishableCollectionSchemaFields } = genSchemaFields(defaultSchemaDefTypes.publishable);
const { schemaFields: withPermissionsCollectionSchemaFields } = genSchemaFields(
  defaultSchemaDefTypes.withPermissions
);

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
  __yState?: string;
  __yVersions?: CollectionDocVersion[];
  history: Array<{
    type: string;
    user: mongoose.Types.ObjectId;
    at: string; // ISO string
  }>;
}

interface CollectionDocVersion {
  state: string;
  timestamp: Date;
  users: Array<Record<string, unknown>>;
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
