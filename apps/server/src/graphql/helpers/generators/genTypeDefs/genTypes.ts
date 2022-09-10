import { capitalize } from '@cristata/utils';
import { GenSchemaInput, SchemaDefType } from '../genSchema';
import { calcGraphFieldType } from './calcGraphFieldType';
import { parseSchemaComponents } from './parseSchemaComponents';

interface GenTypesParams {
  schema: SchemaDefType;
  /**
   * The GraphQL type of the collection.
   */
  typeName: string;
  /**
   * The GraphQL input type that should be inherited by the ModifyInput type.
   */
  typeInheritance?: string;
  customQueries?: GenSchemaInput['customQueries'];
}

/**
 * Generates the types for the collection type definitions.
 */
function genTypes({ typeName, typeInheritance, customQueries, ...args }: GenTypesParams): string {
  const { schemaDefs, schemaRefs, nestedSchemas, arraySchemas } = parseSchemaComponents(args.schema);

  return `
    type ${typeName} ${typeInheritance ? `inherits ${typeInheritance}` : ``} {
      ${
        // list the field and type for each schema definition
        schemaDefs?.map(([fieldName, fieldDef]) => `${fieldName}: ${calcGraphFieldType(fieldDef)}`).join('\n')
      }
      ${
        // list the field and type for each schema reference
        schemaRefs
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
        nestedSchemas?.map(([fieldName]) => `${fieldName}: ${typeName}${capitalize(fieldName)}`).join('\n')
      }
    }

    ${arraySchemas
      ?.map(([fieldName, arraySchema]) => {
        return genTypes({ schema: arraySchema[0], typeName: `${typeName}${capitalize(fieldName)}` });
      })
      .join('\n')}

    ${nestedSchemas
      ?.map(([fieldName, nestedSchema]) => {
        const isPublishableCollection = typeInheritance?.indexOf('PublishableCollection') === 0;
        const isPlainCollection = typeInheritance?.indexOf('Collection') === 0;
        const isPeopleField = fieldName === 'people';
        const isTimestampsField = fieldName === 'timestamps';
        const isPermissionsField = fieldName === 'permissions';

        let nextTypeInheritance = '';
        if (isPeopleField) {
          if (isPublishableCollection) nextTypeInheritance = `PublishableCollectionPeople`;
          else if (isPlainCollection) nextTypeInheritance = `CollectionPeople`;
        } else if (isTimestampsField) {
          if (isPublishableCollection) nextTypeInheritance = `PublishableCollectionTimestamps`;
          else if (isPlainCollection) nextTypeInheritance = `CollectionTimestamps`;
        } else if (isPermissionsField) {
          nextTypeInheritance = `CollectionPermissions`;
        }

        return genTypes({
          schema: nestedSchema,
          typeName: `${typeName}${capitalize(fieldName)}`,
          typeInheritance: nextTypeInheritance,
        });
      })
      .join('\n')}

      ${
        customQueries
          ? customQueries
              .map((query) => {
                let name = typeName + capitalize(query.name);
                if (query.public === true) name += 'Public';

                // return type manually specified because
                // the type already exists
                const manual = !query.returns.includes('{');
                if (manual) return ``;

                const typeObject = query.returns.replace('{', '{\n').replace('}', '\n}').replace(/,/g, '\n');
                return `
            type ${name} ${typeObject}
            `;
              })
              .join('\n')
          : ``
      }
  `;
}

export { genTypes };
