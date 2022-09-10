import mongoose, { SchemaDefinitionProperty } from 'mongoose';

/**
 * For a mongoose schema input object, convert first level of nested objects
 * into subdocuments and return as a new object.
 *
 * _Does not mutate the input object._
 */
function convertTopNestedObjectsToSubdocuments(
  basicSchemaFields: Record<string, unknown>
): Record<string, unknown> {
  const complexSchemaFields: Record<string, unknown> = {};
  Object.entries(basicSchemaFields).forEach(([key, value]) => {
    // if the schema value is an object of properties, convert the object into a schema
    // (check !value.type to ensure that it is an object instead of a complex schema def)
    // (check !value.paths to ensure that it is an object intead of a mongoose schema)
    // (do not create _id for these schemas)
    // @ts-expect-error type and paths *might* be inside value
    if (Object.prototype.toString.call(value) === '[object Object]' && !value.type && !value.paths) {
      const SubSchema = new mongoose.Schema(value as { [key: string]: SchemaDefinitionProperty | undefined }, {
        _id: false,
      });
      complexSchemaFields[key] = { type: SubSchema, default: () => ({}) };
    } else {
      complexSchemaFields[key] = value;
    }
  });

  return complexSchemaFields;
}

export { convertTopNestedObjectsToSubdocuments };
