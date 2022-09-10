import { isObject } from '@cristata/utils';
import { SchemaType } from './genSchema';
import { calcGraphFieldType } from './calcGraphFieldType';

/**
 * Calculate the accessor name and type for the collection.
 *
 * The accessor is the identifier that is used to query and mutate
 * specific documents.
 */
function calcAccessor(
  quantity: 'one' | 'many',
  by?: [string, SchemaType] | { one: [string, SchemaType]; many: [string, SchemaType] }
): string[] {
  // same for one and many
  if (Array.isArray(by)) {
    return [by[0], calcGraphFieldType({ type: by[1], required: quantity === 'one' })];
  }

  // specialized for one
  else if (isObject(by) && quantity === 'one') {
    return [by.one[0], calcGraphFieldType({ type: by.one[1], required: true })];
  }

  // specialized for many
  else if (isObject(by) && quantity === 'many') {
    return [by.many[0], calcGraphFieldType({ type: by.many[1], required: false })];
  }

  // use default when no config provided
  return ['_id', calcGraphFieldType({ type: 'ObjectId', required: quantity === 'one' })];
}

export { calcAccessor };
