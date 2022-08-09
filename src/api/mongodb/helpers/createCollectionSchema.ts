import mongoose from 'mongoose';
import { Collection } from '../../types/config';
import { constructBasicSchemaFields } from './constructBasicSchemaFields';
import { convertTopNestedObjectsToSubdocuments } from './convertTopNestedObjectsToSubdocuments';

/**
 * Creates a new mongoose Schema from a provided collection configuration.
 * Default collection fields will be merged into the collection configuration's schema.
 */
function createCollectionSchema(collection: Collection) {
  return new mongoose.Schema(convertTopNestedObjectsToSubdocuments(constructBasicSchemaFields(collection)));
}

export { createCollectionSchema };
