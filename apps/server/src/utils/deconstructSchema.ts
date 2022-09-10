import {
  isSchemaDef,
  isSchemaRef,
  SchemaDef,
  SchemaDefType,
  SchemaType,
} from '../graphql/helpers/generators/genSchema';

interface AppSchemaDef<T extends SchemaType | 'DocArray' = SchemaType> extends Omit<SchemaDef, 'type'> {
  type: T;
  docs: T extends 'DocArray' ? DeconstructedSchemaDefType : undefined;
}

type DeconstructedSchemaDefType = [string, AppSchemaDef | AppSchemaDef<'DocArray'>][];

function deconstructSchema(schemaDefObject: SchemaDefType, parentKey?: string): DeconstructedSchemaDefType {
  const schemaDefs: DeconstructedSchemaDefType = [];

  Object.entries(schemaDefObject).forEach(([key, def]) => {
    const constructedKey = `${parentKey ? parentKey + '.' : ''}${key}`;

    // is a schema definition for a specific field
    if (isSchemaDef(def)) {
      schemaDefs.push([constructedKey, { ...def, docs: undefined }]);
    }
    // is a reference to a field in another document
    else if (isSchemaRef(def)) {
      null;
    }
    // is an array containing schema defs (stored in db as an array of subdocuments)
    else if (Array.isArray(def)) {
      schemaDefs.push([constructedKey, { type: 'DocArray', docs: deconstructSchema(def[0], constructedKey) }]);
    }
    // is an object containing schema defs (nested schemas)
    else {
      schemaDefs.push(...deconstructSchema(def, constructedKey));
    }
  });

  return schemaDefs;
}

export { deconstructSchema };
export type { DeconstructedSchemaDefType };
