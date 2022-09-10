import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import pluralize from 'pluralize';
import { Collection } from '../types/config';

async function createTextIndex(
  collection: Collection,
  Schema: mongoose.Schema,
  tenantDB: mongoose.Connection
): Promise<void> {
  const { textIndexFieldNames } = collection;
  const fieldNames = [...textIndexFieldNames, 'hidden'];

  const create = () => {
    Schema.index(merge({}, ...fieldNames.map((fieldName) => ({ [fieldName]: 'text' }))), {
      name: 'textIndex',
      background: false,
    });
  };

  // if the index already exists, but the fields in the index do not match,
  // recreate the index with the correct fields
  // OR create the index if the index does not already exist
  const currentDbCollection = tenantDB.collection(pluralize(collection.name).toLowerCase());
  // @ts-expect-error full: true is valid and has an effect
  const existingIndexes = (await currentDbCollection.getIndexes({ full: true })) || [];
  const existingTextIndex = existingIndexes.find((i: { name: string }) => i.name === 'textIndex');
  if (existingTextIndex?.weights) {
    const existingTextIndexFields = Object.keys(existingTextIndex.weights);
    const indexesMatch =
      existingTextIndexFields.length === fieldNames.length &&
      fieldNames.every((fieldName) => existingTextIndexFields.includes(fieldName));
    if (!indexesMatch) {
      // drop the current text index so that mongoose will recreate it when it converts
      // the schema to a model
      await currentDbCollection.dropIndex('textIndex');

      // create the index
      create();
    }
  } else {
    // create the index
    create();
  }
}

export { createTextIndex };
