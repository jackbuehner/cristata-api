import { hasKey, isArray } from '@jackbuehner/cristata-utils';
import { merge } from 'merge-anything';
import mongoose, { SchemaDefinition } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { Type } from './Type';
import {
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefType,
  SchemaDefaultValueType,
  isSchemaDef,
  isSchemaDefOrType,
  isTypeTuple,
} from './genSchema';

interface GenSchemaFieldsOpts {
  /**
   * Overrides the `required` option for every schema field to always have
   * a value of `false`. This can be useful when using a copy of the schema
   * as a subdocument that might not initially exist (e.g. `__publishedDoc`).
   */
  neverRequired?: boolean;
}

function genSchemaFields(
  schemaDef: SchemaDefType,
  opts?: GenSchemaFieldsOpts
): {
  schemaFields: SchemaDefinition;
  textIndexFieldNames: string[];
} {
  const schema = Object.entries(schemaDef).filter(
    (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef | [SchemaDefType]] =>
      isSchemaDefOrType(schemaDefItem[1]) || Array.isArray(schemaDefItem[1])
  );

  const textIndexFieldNames: string[] = [];

  const genSchema = (
    schema: [string, SchemaDefType | SchemaDef | [SchemaDefType]][]
  ): Record<string, mongoose.SchemaDefinitionProperty<undefined>> => {
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
          let type;
          if (isTypeTuple(fieldDef.type)) type = fieldDef.type[1];
          else type = fieldDef.type;

          // the type is 'JSON', return a new schema that can
          // contain any values
          if (Type.isObject(type)) {
            if (Type.isArray(type)) {
              return {
                [fieldName]: [new mongoose.Schema({}, { strict: fieldDef.strict })],
              };
            }
            return {
              [fieldName]: new mongoose.Schema({}, { strict: fieldDef.strict }),
            };
          }

          // process type
          const isArray = Type.isArray(type);
          if (isArray) type = type[0];
          if (Type.isBoolean(type)) {
            if (isArray) type = [mongoose.Schema.Types.Boolean];
            else type = mongoose.Schema.Types.Boolean;
          } else if (Type.isDate(type)) {
            if (isArray) type = [mongoose.Schema.Types.Date];
            else type = mongoose.Schema.Types.Date;
          } else if (Type.isInt(type)) {
            if (isArray) type = [mongoose.Schema.Types.Number];
            else type = mongoose.Schema.Types.Number;
          } else if (Type.isFloat(type)) {
            if (isArray) type = [mongoose.Schema.Types.Number];
            else type = mongoose.Schema.Types.Number;
          } else if (Type.isObjectId(type)) {
            if (isArray) type = [mongoose.Schema.Types.ObjectId];
            else type = mongoose.Schema.Types.ObjectId;
          } else if (Type.isEncryptedString(type) || Type.isString(type)) {
            if (isArray) type = [mongoose.Schema.Types.String];
            else type = mongoose.Schema.Types.String;
          }

          if (fieldDef.textSearch) textIndexFieldNames.push(fieldName);

          return {
            [fieldName]: {
              type: type,
              required: opts?.neverRequired ? false : fieldDef.required || false,
              unique: fieldDef.unique || false,
              default: calcDefaultValue(fieldDef.default),
            },
          };
        }

        // if the field definitions is an array containing multiple
        // schema definitions, individually process each key-value
        // pair into an object containing the schema for the array
        else if (Array.isArray(fieldDef)) {
          const schema = Object.entries(fieldDef[0]).filter(
            (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef] =>
              isSchemaDefOrType(schemaDefItem[1])
          );
          return { [fieldName]: [genSchema(schema)] };
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

  return { schemaFields: genSchema(schema), textIndexFieldNames };
}

/**
 * Calculate the default value for a new document.
 */
function calcDefaultValue(val: SchemaDefaultValueType | undefined): unknown {
  // if a string, use the string
  if (typeof val === 'string') return val;
  // if a number, use the number
  else if (typeof val === 'number') return val;
  // if a boolean, use the boolean
  else if (typeof val === 'boolean') return val;
  // if an array, use process the values of the array
  else if (isArray(val)) return val.map((v: SchemaDefaultValueType) => calcDefaultValue(v)).filter((v) => !!v);
  // if a specification for a code, generate the code
  else if (val && hasKey('code', val) && hasKey('length', val)) {
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
