import { defaultSchemaDefTypes, genSchemaFields } from '@jackbuehner/cristata-generator-schema';
import { copy } from 'copy-anything';
import { mergeAndConcat } from 'merge-anything';
import mongoose from 'mongoose';
import { Collection } from '../../types/config';

/**
 * Merges preset schema fields per the config with fields from the collection config.
 */
function constructBasicSchemaFields(collection: Collection) {
  if (collection.name === 'Activity') return collection.schemaFields;

  const basicSchema = mergeAndConcat(
    collectionSchemaFields,
    collection.schemaFields,
    collection.canPublish ? publishableCollectionSchemaFields : {},
    collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
  );

  if (collection.generationOptions?.independentPublishedDocCopy) {
    const schemaCopy = copy(basicSchema);

    // TODO: filter keys not at the top level
    const schemaCopyWithoutPrivateKeys = Object.fromEntries(
      Object.entries(schemaCopy).filter(([key]) => key.indexOf('_') !== 0)
    );

    basicSchema.__publishedDoc = schemaCopyWithoutPrivateKeys;
    console.log(collection.name, basicSchema);
  }

  return basicSchema;
}

// schema fields to include in every collection
const { schemaFields: collectionSchemaFields } = genSchemaFields(defaultSchemaDefTypes.standard);
const { schemaFields: publishableCollectionSchemaFields } = genSchemaFields(defaultSchemaDefTypes.publishable);
const { schemaFields: withPermissionsCollectionSchemaFields } = genSchemaFields(
  defaultSchemaDefTypes.withPermissions
);

type GitHubTeamNodeID = string;

interface CollectionSchemaFields {
  _id: mongoose.Types.ObjectId;
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

interface PrivateCollectionDocFields {
  __yState?: string;
  __yVersions?: CollectionDocVersion[];
  __publishedDoc?:
    | (CollectionSchemaFields & PublishableCollectionSchemaFields & Record<string, unknown>)
    | null;
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
  /**
   * `true` when the doc has been published and a copy of the published doc is stored
   */
  _hasPublishedDoc?: boolean;
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
  PrivateCollectionDocFields,
  PublishableCollectionSchemaFields,
  GitHubTeamNodeID,
};
