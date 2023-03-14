import { defaultSchemaDefTypes, genSchemaFields } from '@jackbuehner/cristata-generator-schema';
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
    // get a copy of the collection schema with no fields that are required, which
    // is necessary because we cannot require fields in the __piblishedDoc object
    // before the document is published
    const { schemaFields: notRequiredSchemaFields } = genSchemaFields(collection.schemaDef, {
      neverRequired: true,
    });

    // re-create the complete schema but with the not required schema fields
    const notRequiredBasicSchema = mergeAndConcat(
      { _id: { type: mongoose.Schema.Types.ObjectId } },
      collectionSchemaFields,
      notRequiredSchemaFields,
      collection.canPublish ? publishableCollectionSchemaFields : {},
      collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
    ) as { [path: string]: mongoose.SchemaDefinitionProperty<undefined> };

    // TODO: filter keys not at the top level
    const notRequiredSchemaWithoutPrivateKeys: typeof notRequiredBasicSchema = Object.fromEntries(
      Object.entries(notRequiredBasicSchema).filter(([key]) => key.indexOf('_') !== 0 || key === '_id')
    );

    basicSchema.__publishedDoc = notRequiredSchemaWithoutPrivateKeys;
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
