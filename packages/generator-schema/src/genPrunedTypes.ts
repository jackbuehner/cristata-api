import { capitalize } from '@jackbuehner/cristata-utils';
import { SchemaDefType } from './genSchema';
import { calcGraphFieldType } from './calcGraphFieldType';
import { parseSchemaComponents } from './parseSchemaComponents';

interface GenPrunedTypesParams {
  schema: SchemaDefType;
  /**
   * The GraphQL type of the collection.
   */
  typeName: string;
  /**
   * Whether the collection docs can be published.
   */
  isPublishable: boolean;
}

/**
 * Generates the pruned types for the collection type definitions.
 */
function genPrunedTypes({ typeName, isPublishable, ...args }: GenPrunedTypesParams): string {
  const { schemaDefs, schemaRefs, nestedSchemas, arraySchemas } = parseSchemaComponents(args.schema);
  const schemaDefsPublic = schemaDefs.filter(([, fieldDef]) => !!fieldDef.public);
  const schemaRefsPublic = schemaRefs.filter(([, fieldDef]) => !!fieldDef.public);

  return `
    type ${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName} {
      ${
        // list the field and type for each schema definition
        schemaDefsPublic
          ?.map(([fieldName, fieldDef]) => `${fieldName}: ${calcGraphFieldType(fieldDef)}`)
          .join('\n') || `void: Void`
      }
      ${
        // list the field and type for each schema definition
        schemaRefsPublic
          ?.map(
            ([fieldName, fieldRef]) =>
              `${fieldName}: ${calcGraphFieldType({ type: fieldRef.fieldType, required: false })}`
          )
          .join('\n')
      }
      ${
        // list the field and type for each instance of a schema in an array
        arraySchemas?.map(([fieldName]) => `${fieldName}: [${typeName}${capitalize(fieldName)}]`).join('\n')
      }
      ${
        // list the field and type for each set of nested schema definitions
        nestedSchemas
          ?.map(
            ([fieldName]) =>
              `${fieldName}: ${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName}${capitalize(fieldName)}`
          )
          .join('\n')
      }
    }

    ${arraySchemas
      ?.map(([fieldName, arraySchema]) => {
        return genPrunedTypes({
          schema: arraySchema[0],
          typeName: `${typeName}${capitalize(fieldName)}`,
          isPublishable,
        });
      })
      .join('\n')}

    ${nestedSchemas
      ?.map(([fieldName, nestedSchema]) => {
        if (isPublishable && fieldName === 'timestamps') {
          nestedSchema['published_at'] = { type: 'Date', required: true, public: true };
          nestedSchema['updated_at'] = { type: 'Date', required: true, public: true };
          return genPrunedTypes({
            schema: nestedSchema,
            typeName: `Pruned${typeName}Timestamps`,
            isPublishable,
          });
        }

        return genPrunedTypes({
          schema: nestedSchema,
          typeName: `${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName}${capitalize(fieldName)}`,
          isPublishable,
        });
      })
      .join('')}
  `;
}

export { genPrunedTypes };
