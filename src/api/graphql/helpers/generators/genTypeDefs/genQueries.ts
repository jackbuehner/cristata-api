import pluralize from 'pluralize';
import { capitalize } from '../../../../utils/capitalize';
import { uncapitalize } from '../../../../utils/uncapitalize';
import { GenSchemaInput, SchemaDefType } from '../genSchema';

interface GenQueriesParams {
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
   * Whether public queries should be made available. Defaults to false.
   * Provide `'withSlug'` if public queries should also also allow accessing
   * docs by their slug field.
   */
  usePublicQueries?: boolean | 'withSlug';
  customQueries: GenSchemaInput['customQueries'];
  options: GenSchemaInput['options'];
}

/**
 * Generates the query type definitions for the collection.
 */
function genQueries(args: GenQueriesParams): string {
  if (args.usePublicQueries === undefined) args.usePublicQueries = false;

  return `
    type Query {
      ${
        args.options?.disableFindOneQuery !== true
          ? `
              """
              Get a ${args.typeName} document by ${args.accessor.one.name}.
              """
              ${uncapitalize(args.typeName)}(${args.accessor.one.name}: ${args.accessor.one.typeName}): ${
              args.typeName
            }
            `
          : ``
      }
      ${
        args.options?.disableFindManyQuery !== true
          ? `
              """
              Get a set of ${args.typeName} documents by ${args.accessor.many.name}.
              If ${args.accessor.many.name} is omitted, the API will return all ${args.typeName} documents.
              """
              ${pluralize(uncapitalize(args.typeName))}(${args.accessor.many.name}s: [${
              args.accessor.many.typeName
            }], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<${args.typeName}>  
            `
          : ``
      }
      ${
        args.options?.disableActionAccessQuery !== true
          ? `
              """
              Get the permissions of the currently authenticated user for the
              ${args.typeName} collection.
              """
              ${uncapitalize(args.typeName)}ActionAccess(_id: ObjectID): CollectionActionAccess
            `
          : ``
      }
      ${
        args.options?.disablePublicFindOneQuery !== true && args.usePublicQueries !== false
          ? `
              """
              Get a pruned ${args.typeName} document by ${args.accessor.one.name}.
              """
              ${uncapitalize(args.typeName)}Public(${args.accessor.one.name}: ${
              args.accessor.one.typeName
            }): Pruned${args.typeName}
            `
          : ``
      }
      ${
        args.options?.disablePublicFindManyQuery !== true && args.usePublicQueries !== false
          ? `
              """
              Get a set of pruned ${args.typeName} documents by ${args.accessor.many.name}.
              If ${args.accessor.many.name} is omitted, the API will return all ${args.typeName} documents.
              """
              ${pluralize(uncapitalize(args.typeName))}Public(${args.accessor.many.name}s: [${
              args.accessor.many.typeName
            }], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Pruned${args.typeName}>
            `
          : ``
      }
      ${
        args.options?.disablePublicFindOneBySlugQuery !== true && args.usePublicQueries === 'withSlug'
          ? `
              """
              Get a pruned ${args.typeName} document by ${args.accessor.one.name}.

              Provide the date of to ensure that the correct document is provided
              (in case the slug is not unique).
              """
              ${uncapitalize(args.typeName)}BySlugPublic(slug: String!, date: Date): Pruned${args.typeName}
            `
          : ``
      }

      ${
        args.customQueries
          ? args.customQueries
              .map((query) => {
                let name = uncapitalize(args.typeName) + capitalize(query.name);
                if (query.public === true) name += 'Public';

                const manual = !query.returns.includes('{');
                if (manual) {
                  return `
                    """
                    ${query.description}
                    """
                    ${name}${query.accepts ? `(${query.accepts})` : ``}: ${query.returns}
                  `;
                }

                const returnsArray = query.returns.includes('[') && query.returns.includes(']');
                return `
                  """
                  ${query.description}
                  """
                  ${name}${query.accepts ? `(${query.accepts})` : ``}: ${
                  returnsArray ? `[${capitalize(name)}]` : capitalize(name)
                }
                `;
              })
              .join('\n')
          : ``
      }
    }
  `;
}

export { genQueries };
