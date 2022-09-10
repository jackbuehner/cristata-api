import { capitalize } from '@cristata/utils';
import {
  isNestedSchemaDefType,
  isSchemaDef,
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefType,
} from '../genSchema';
import { calcGraphFieldType } from './calcGraphFieldType';
import { parseSchemaComponents } from './parseSchemaComponents';

interface GenInputsParams {
  schema: SchemaDefType;
  /**
   * The GraphQL type of the collection.
   */
  typeName: string;
  /**
   * The GraphQL input type that should be inherited by the ModifyInput type.
   */
  typeInheritance?: string;
  /**
   * Whether the all fields should be forced to be modifiable.
   */
  forceModify?: boolean;
}

/**
 * Generates the input types for the collection type definitions.
 */
function genInputs({ typeName, typeInheritance, forceModify, ...args }: GenInputsParams): string {
  const { schemaDefs, nestedSchemas, arraySchemas } = parseSchemaComponents(args.schema);

  if (forceModify) {
    schemaDefs.forEach((_, index) => {
      schemaDefs[index][1].modifiable = true;
    });
  }

  return `
    input ${typeName}${typeName.includes('ModifyInput') ? `` : `ModifyInput`} ${
    typeInheritance ? `inherits ${typeInheritance}` : ``
  }
    {
      yState: String
      ${
        // list the field and type for each schema definition
        schemaDefs
          ?.filter(([, fieldDef]) => fieldDef.modifiable === true)
          .map(
            ([fieldName, fieldDef]) =>
              `${fieldName}: ${calcGraphFieldType(fieldDef, { allOptional: true, useMongooseType: true })}`
          )
          .join('\n') || 'void: Void\n'
      }
      ${
        // list the field and type for each set of nested schema definitions
        [...nestedSchemas, ...arraySchemas]
          ?.map(([fieldName, def]) => {
            const isArray = Array.isArray(def);
            const fieldType = `${typeName}${typeName.includes('ModifyInput') ? `` : `ModifyInput`}${capitalize(
              fieldName
            )}`;
            return `${fieldName}: ${isArray ? '[' : ''}${fieldType}${isArray ? ']' : ''}`;
          })
          .join('\n')
      }
    }

    ${[...nestedSchemas, ...arraySchemas]
      ?.map(([fieldName, def]) => {
        const schemaDefs: [string, SchemaDef | Omit<SchemaDef, 'modifiable'>][] = [];
        const nestedSchemas: [string, NestedSchemaDefType][] = [];

        // extract the defs
        const schemaEntries = Object.entries(Array.isArray(def) ? def[0] : def);
        const extractedSchemaDefs = schemaEntries.filter((entry): entry is [string, SchemaDef] =>
          isSchemaDef(entry[1])
        );
        const extractedNestedSchemas = schemaEntries.filter((entry): entry is [string, NestedSchemaDefType] =>
          isNestedSchemaDefType(entry[1])
        );
        schemaDefs.push(...extractedSchemaDefs);
        nestedSchemas.push(...extractedNestedSchemas);

        // reconstruct a schema def containing the schemaDefs and the nestedSchemas
        const topSchema: SchemaDefType = {};
        const arr = [...schemaDefs, ...nestedSchemas];
        arr.forEach(([key, value]) => {
          topSchema[key] = value;
        });

        // inject permissins types for permissions field
        if (fieldName === 'permissions') {
          topSchema['users'] = { type: ['ObjectId'] };
          topSchema['teams'] = { type: ['ObjectId'] };
        }

        // generate input types for nested schemas
        return genInputs({
          schema: topSchema,
          typeName: `${typeName}${typeName.includes('ModifyInput') ? `` : `ModifyInput`}${capitalize(
            fieldName
          )}`,
          typeInheritance: undefined,
          forceModify: true,
        });
      })
      .join('')}
  `;
}

export { genInputs };
