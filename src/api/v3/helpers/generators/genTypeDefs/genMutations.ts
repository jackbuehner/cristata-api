import { calcGraphFieldType, parseSchemaComponents } from '.';
import { capitalize } from '../../../../../utils/capitalize';
import { hasKey } from '../../../../../utils/hasKey';
import { uncapitalize } from '../../../../../utils/uncapitalize';
import { GenSchemaInput, SchemaDefType } from '../genSchema';

interface GenMutationsParams {
  schema: SchemaDefType;
  /**
   * The GraphQL type of the collection.
   */
  typeName: string;
  /**
   * The key name of the accessor and the associated GraphQL type.
   */
  accessor: Record<'one' | 'many', { name: string; typeName: string }>;
  /**
   * Whether the collection docs can be published.
   */
  isPublishable: boolean;
  /**
   * The GraphQL type for the input parameter of the modify mutation.
   * Will be automatically generated if not defined.
   */
  modifyMutationInputTypeName?: string;
  customMutations: GenSchemaInput['customMutations'];
  options: GenSchemaInput['options'];
}

/**
 * Generates the mutation type definitions for the collection.
 */
function genMutations(args: GenMutationsParams) {
  const createArgsString = genCreateArgs(args.typeName, args.schema);

  return `
    type Mutation {
      ${
        args.options?.disableCreateMutation !== true
          ? `
              """
              Create a new ${args.typeName} document.
              """
              ${uncapitalize(args.typeName)}Create(${createArgsString}): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableModifyMutation !== true
          ? `
              """
              Modify an existing ${args.typeName} document.
              """
              ${uncapitalize(args.typeName)}Modify(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, input: ${
              args.modifyMutationInputTypeName
                ? args.modifyMutationInputTypeName
                : `${args.typeName}ModifyInput!`
            }): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableHideMutation !== true
          ? `
              """
              Set whether an existing ${args.typeName} document is hidden.
        
              This mutation sets hidden: true by default.
        
              Hidden ${args.typeName} documents should not be presented to clients;
              this is analogous to moving the document to a deleted items folder
              """
              ${uncapitalize(args.typeName)}Hide(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, hide: Boolean): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableArchiveMutation !== true
          ? `
              """
              Set whether an existing ${args.typeName} document is archived.
        
              This mutation sets archived: true by default.
        
              Archived ${args.typeName} documents should not be presented to clients
              unless they explicitly request to view archived items.
              """
              ${uncapitalize(args.typeName)}Archive(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, archive: Boolean): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableLockMutation !== true
          ? `
              """
              Set whether an existing ${args.typeName} document is locked.
        
              This mutation sets locked: true by default.
        
              Locked ${args.typeName} documents should only be editable by the server
              and by admins.
              """
              ${uncapitalize(args.typeName)}Lock(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, lock: Boolean): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableWatchMutation !== true
          ? `
              """
              Add a watcher to a ${args.typeName} document.
        
              This mutation adds the watcher by default. If a user _id is
              not specified, for the watcher, the currently authenticated user will
              be used.
              """
              ${uncapitalize(args.typeName)}Watch(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, watcher: ObjectID, watch: Boolean): ${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disableDeleteMutation !== true
          ? `
              """
              Deletes a ${args.typeName} document.
              """
              ${uncapitalize(args.typeName)}Delete(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }): Void
            `
          : ``
      }
      ${
        args.options?.disablePublishMutation !== true && args.isPublishable
          ? `
              """
              Publishes an existing ${args.typeName} document.
              """
              ${uncapitalize(args.typeName)}Publish(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }, published_at: Date, publish: Boolean): ${args.typeName}
            `
          : ``
      }
      ${
        args.customMutations
          ? args.customMutations
              .map((mutation) => {
                let name = uncapitalize(args.typeName) + capitalize(mutation.name);
                if (mutation.public === true) name += 'Public';

                if (hasKey('inc', mutation.action)) {
                  const inc = `inc${capitalize(mutation.action.inc[0])}`;
                  return `
                    """
                    ${mutation.description}
                    """
                    ${name}(_id: ObjectID!, ${inc}: ${mutation.action.inc[1]}!): ${args.typeName}
                  `;
                }
              })
              .join('\n')
          : ``
      }
    }
  `;
}

function genCreateArgs(typeName: string, topSchema: SchemaDefType): string {
  const { schemaDefs } = parseSchemaComponents(topSchema);

  // list the top-level fields
  const fieldString = schemaDefs
    .map(
      ([fieldName, fieldDef]) =>
        `${fieldName}: ${calcGraphFieldType(fieldDef, { optionalInitial: true, useMongooseType: true })}`
    )
    .join(', ');

  // if this is a user document, also add option to specify username
  if (typeName === 'User') return fieldString + ', username: String!';

  return fieldString;
}

export { genMutations };
