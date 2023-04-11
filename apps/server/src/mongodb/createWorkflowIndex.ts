import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import pluralize from 'pluralize';
import { Collection } from '../types/config';

async function createWorkflowIndex(
  collection: Collection,
  Schema: mongoose.Schema,
  tenantDB: mongoose.Connection
): Promise<void> {
  const fieldNames = ['stage', 'hidden', 'archived', 'permissions', 'name', '_id'];

  const create = () => {
    Schema.index(merge({}, ...fieldNames.map((fieldName) => ({ [fieldName]: 1 }))), {
      name: 'workflow',
      background: true,
      partialFilterExpression: {
        stage: { $exists: true, $lt: 5 },
        hidden: false,
        archived: false,
      },
    });
  };

  // if the index already exists, but the fields in the index do not match,
  // recreate the index with the correct fields
  // OR create the index if the index does not already exist
  const currentDbCollection = tenantDB.collection(pluralize(collection.name).toLowerCase());
  // @ts-expect-error full: true is valid and has an effect
  const existingIndexes = (await currentDbCollection.getIndexes({ full: true })) || [];
  const existingWorkflowIndex = existingIndexes.find((i: { name: string }) => i.name === 'workflow');
  if (existingWorkflowIndex?.key) {
    const existingIndexFields = Object.keys(existingWorkflowIndex.key);
    const indexesMatch =
      existingIndexFields.length === fieldNames.length &&
      fieldNames.every((fieldName) => existingIndexFields.includes(fieldName));
    if (!indexesMatch) {
      // drop the current text index so that mongoose will recreate it when it converts
      // the schema to a model
      console.log(`Dropping workflow index in ${currentDbCollection.name}`);
      await currentDbCollection.dropIndex('workflow');

      // create the index
      console.log(`Creating workflow index in ${currentDbCollection.name}`);
      create();
    }
  } else {
    // create the index
    console.log(`Creating workflow index in ${currentDbCollection.name}`);
    create();
  }
}

export { createWorkflowIndex };
