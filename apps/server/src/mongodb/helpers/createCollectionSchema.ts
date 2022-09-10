import { isArray, isObject } from '@jackbuehner/cristata-utils';
import mongoose from 'mongoose';
import { Collection } from '../../types/config';
import { constructBasicSchemaFields } from './constructBasicSchemaFields';
import { convertTopNestedObjectsToSubdocuments } from './convertTopNestedObjectsToSubdocuments';

/**
 * Creates a new mongoose Schema from a provided collection configuration.
 * Default collection fields will be merged into the collection configuration's schema.
 */
function createCollectionSchema(collection: Collection) {
  const basic = constructBasicSchemaFields(collection);
  const topSubDocs = convertTopNestedObjectsToSubdocuments(basic);

  const schema: Record<string, Record<string, unknown> | Record<string, unknown>[]> = {};
  Object.entries(topSubDocs).forEach(([key, value]) => {
    if (isObject(value)) schema[key] = value;
    else if (isArraySchema(value)) schema[key] = value;
  });

  return new mongoose.Schema(schema);
}

function isArraySchema(toCheck: unknown): toCheck is Record<string, unknown>[] {
  return isArray(toCheck) && toCheck.every((c) => isObject(c));
}

export { createCollectionSchema };
