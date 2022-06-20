import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import pluralize from 'pluralize';
import { Collection } from '../types/config';
import { uncapitalize } from '../utils/uncapitalize';

async function createTextIndex(
  collection: Collection,
  Schema: mongoose.Schema,
  tenantDB: mongoose.Connection
): Promise<void> {
  const { textIndexFieldNames } = collection;

  if (textIndexFieldNames.length === 0) {
    return;
  }

  console.log(`\x1b[36mCreating text search index for ${collection.name} collection...\x1b[0m`);

  Schema.index(merge({}, ...textIndexFieldNames.map((fieldName) => ({ [fieldName]: 'text' }))), {
    name: 'textIndex',
    background: false,
  });

  // if the index already exists, but the fields in the index do not match,
  // recreate the index with the correct fields
  const currentDbCollection = tenantDB.collection(uncapitalize(pluralize(collection.name)));
  // @ts-expect-error full: true is valid and has an effect
  const existingIndexes = (await currentDbCollection.getIndexes({ full: true })) || [];
  const existingTextIndex = existingIndexes.find((i) => i.name === 'textIndex');
  if (existingTextIndex) {
    const existingTextIndexFields = Object.keys(existingTextIndex.weights);
    const indexesMatch =
      existingTextIndexFields.length === textIndexFieldNames.length &&
      textIndexFieldNames.every((fieldName) => existingTextIndexFields.includes(fieldName));
    if (!indexesMatch) {
      // drop the current text index so that mongoose will recreate it when it converts
      // the schema to a model
      await currentDbCollection.dropIndex('textIndex');
    }
  }
}

export { createTextIndex };
