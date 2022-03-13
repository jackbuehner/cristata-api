import { merge } from 'merge-anything';
import { Schema, SchemaDefinition } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { hasKey } from '../../../../utils/hasKey';
import { isArray } from '../../../../utils/isArray';
import {
  GenSchemaInput,
  isSchemaDef,
  isSchemaDefOrType,
  isTypeTuple,
  MongooseSchemaType,
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefaultValueType,
  SchemaDefType,
} from './genSchema';

function genSchemaFields(input: GenSchemaInput): SchemaDefinition {
  const schema = Object.entries(input.schemaDef).filter(
    (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef] =>
      isSchemaDefOrType(schemaDefItem[1])
  );

  const genSchema = (schema: [string, SchemaDefType | SchemaDef][]) => {
    // merge the array of schema objects into a single object
    return merge(
      {},
      ...schema.map(([fieldName, fieldDef]) => {
        // if the field definition is a valid schema definition, generate
        // the schema from the field
        if (isSchemaDef(fieldDef)) {
          // get the mongoose schema type, which is either the second
          // key in an array of types ([graphql type, mongoose type])
          // or is the directly provided value
          let type: MongooseSchemaType;
          if (isTypeTuple(fieldDef.type)) type = fieldDef.type[1];
          else type = fieldDef.type;

          // the type is 'JSON', return a new schema that can
          // contain any values
          if (type === JSON) {
            return {
              [fieldName]: new Schema({}, { strict: fieldDef.strict }),
            };
          }

          if (type === 'Float') type = Number;

          return {
            [fieldName]: {
              type: type,
              required: fieldDef.required || false,
              unique: fieldDef.unique || false,
              default: calcDefaultValue(fieldDef.default),
            },
          };
        }

        // otherwise, the field definiton is an object containing multiple
        // schema definitions, so each key-value pair needs to be individually
        // processed and returned a an object containing the schema
        else {
          const schema = Object.entries(fieldDef).filter(
            (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef] =>
              isSchemaDefOrType(schemaDefItem[1])
          );
          return { [fieldName]: genSchema(schema) };
        }
      })
    );
  };

  return genSchema(schema);
}

/**
 * Calculate the default value for a new document.
 */
function calcDefaultValue(val: SchemaDefaultValueType) {
  // if a string, use the string
  if (typeof val === 'string') return val;
  // if a number, use the number
  else if (typeof val === 'number') return val;
  // if a boolean, use the boolean
  else if (typeof val === 'boolean') return val;
  // if an array, use process the values of the array
  else if (isArray(val)) return val.map((v: SchemaDefaultValueType) => calcDefaultValue(v)).filter((v) => !!v);
  // if a specification for a code, generate the code
  else if (hasKey('code', val) && hasKey('length', val)) {
    const { code: codeType, length: codeLength } = val;

    // alphanumeric code
    if (codeType === 'alphanumeric') {
      const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', codeLength);
      return generateCode();
    }
  }

  // return undefined if no condition is met
  return undefined;
}

export { genSchemaFields };
