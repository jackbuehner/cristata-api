import {
  isNestedSchemaDefType,
  isSchemaDef,
  isSchemaRef,
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefType,
  SchemaRef,
} from '../genSchema';

function parseSchemaComponents(schema: SchemaDefType) {
  const schemaEntries = Object.entries(schema);
  const schemaDefs = schemaEntries.filter((entry): entry is [string, SchemaDef] => isSchemaDef(entry[1]));
  const schemaRefs = schemaEntries.filter((entry): entry is [string, SchemaRef] => isSchemaRef(entry[1]));
  const arraySchemas = schemaEntries.filter((entry): entry is [string, [SchemaDefType]] =>
    Array.isArray(entry[1])
  );
  const nestedSchemas = schemaEntries.filter((entry): entry is [string, NestedSchemaDefType] =>
    isNestedSchemaDefType(entry[1])
  );

  return { schemaEntries, schemaDefs, schemaRefs, arraySchemas, nestedSchemas };
}

export { parseSchemaComponents };
