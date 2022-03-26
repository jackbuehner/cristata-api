import { isObject } from '../../../../utils/isObject';
import {
  GenSchemaInput,
  GraphSchemaType,
  isSchemaDef,
  isSchemaDefOrType,
  isSchemaRef,
  isTypeTuple,
  MongooseSchemaType,
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefType,
  SchemaRef,
  SchemaType,
} from './genSchema';
import mongoose from 'mongoose';
import { capitalize } from '../../../../utils/capitalize';
import { uncapitalize } from '../../../../utils/uncapitalize';
import { hasKey } from '../../../../utils/hasKey';
import pluralize from 'pluralize';

/**
 * Generate the type definitions for the GraphQL schema.
 */
function genTypeDefs(input: GenSchemaInput): string {
  const schema = Object.entries(input.schemaDef);
  const schemaSansRefs = schema.filter(
    (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef | [SchemaDefType]] =>
      isSchemaDefOrType(schemaDefItem[1]) || isSchemaDefOrType(schemaDefItem[1][0])
  );
  const typeName = input.name;
  const typeInheritance = getTypeInheritance(input.canPublish, input.withPermissions);
  const inputInheritance = getInputInheritance(input.canPublish, input.withPermissions);
  const [oneAccessorName, oneAccessorType] = calcAccessor('one', input.by);
  const [manyAccessorName, manyAccessorType] = calcAccessor('many', input.by);
  const onlyOneModifiable =
    schemaSansRefs.filter(([, fieldDef]) => !Array.isArray(fieldDef) && fieldDef.modifiable).length === 1;
  const hasPublic = JSON.stringify(input.schemaDef).includes(`"public":true`);
  const hasSlug = hasKey('slug', input.schemaDef) && (input.schemaDef.slug as SchemaDef).type === 'String';

  return `
    ${genTypes(schema, typeName, typeInheritance, input.customQueries)}
    ${
      hasPublic
        ? genPrunedTypes(
            [['_id', { type: 'ObjectId', required: true, public: true }], ...schema],
            typeName,
            input.canPublish
          )
        : ``
    }
    ${genInputs(schemaSansRefs, typeName, inputInheritance)}
    ${genQueries(
      typeName,
      oneAccessorName,
      oneAccessorType,
      manyAccessorName,
      manyAccessorType,
      input.customQueries,
      input.options,
      hasPublic && input.publicRules !== false,
      hasSlug
    )}
    ${genMutations(
      schemaSansRefs,
      typeName,
      oneAccessorName,
      oneAccessorType,
      input.canPublish,
      input.customMutations,
      input.options,
      onlyOneModifiable
        ? calcGraphFieldType(
            (schema.filter(([, fieldDef]) => isSchemaDef(fieldDef)) as [string, SchemaDef][]).find(
              ([, fieldDef]) => fieldDef.modifiable
            )[1],
            { useMongooseType: true }
          )
        : undefined
    )}
    ${input.withSubscription ? genSubscriptions(typeName, oneAccessorName, oneAccessorType, input.options) : ``}
  `;
}

/**
 * Generate the type inheritance string for the typeDef.
 */
function getTypeInheritance(canPublish: boolean, withPermissions: boolean) {
  if (canPublish && withPermissions) return 'PublishableCollection, WithPermissions';
  else if (canPublish && !withPermissions) return 'PublishableCollection';
  else if (!canPublish && withPermissions) return 'Collection, WithPermissions';
  return 'Collection';
}

/**
 * Generate the input inheritance string for the typeDef.
 */
function getInputInheritance(canPublish: boolean, withPermissions: boolean) {
  if (withPermissions) return 'WithPermissionsInput';
  return undefined;
}

/**
 * Calculate the accessor name and type for the collection.
 *
 * The accessor is the identifier that is used to query and mutate
 * specific documents.
 */
function calcAccessor(
  quantity: 'one' | 'many',
  by?: [string, SchemaType] | { one: [string, SchemaType]; many: [string, SchemaType] }
): string[] {
  // same for one and many
  if (Array.isArray(by)) {
    return [by[0], calcGraphFieldType({ type: by[1], required: quantity === 'one' })];
  }

  // specialized for one
  else if (isObject(by) && quantity === 'one') {
    return [by.one[0], calcGraphFieldType({ type: by.one[1], required: true })];
  }

  // specialized for many
  else if (isObject(by) && quantity === 'many') {
    return [by.many[0], calcGraphFieldType({ type: by.many[1], required: false })];
  }

  // use default when no config provided
  return ['_id', calcGraphFieldType({ type: 'ObjectId', required: quantity === 'one' })];
}

/**
 * Calculate the type for a given field.
 */
function calcGraphFieldType(
  def: SchemaDef,
  opts?: { allOptional?: boolean; optionalInitial?: boolean; useMongooseType?: boolean }
) {
  let type: GraphSchemaType;

  // if `def.type` is a tuple, the first value will be the one needed by graphql
  if (isTypeTuple(def.type)) {
    if (opts?.useMongooseType) type = Schema.constructType(def.type[1]);
    else type = def.type[0];
  } else type = Schema.constructType(def.type);

  // specify whether the field is required in the schema
  if (def.required && !opts?.allOptional) {
    // if the field as a default value and `optionalInitial` is true in the
    // function options, make the the field optional even though it is
    // marked as required.
    if (opts?.optionalInitial && def.default !== undefined) return `${type}`;

    // otherwise, make the field required.
    return `${type}!`;
  }

  // make field optional by default
  return `${type}`;
}

/**
 * A set of functions for constructing the graphql type
 * based on the mongoose type.
 */
const Schema = {
  constructType: (type: MongooseSchemaType): string => {
    const isArray = Schema.isArray(type);
    //@ts-expect-error it's fine
    if (isArray) type = type[0];

    if (Schema.isBoolean(type)) {
      if (isArray) return '[Boolean]';
      else return 'Boolean';
    }

    if (Schema.isDate(type)) {
      if (isArray) return '[Date]';
      else return 'Date';
    }

    if (Schema.isInt(type)) {
      if (isArray) return '[Int]';
      else return 'Int';
    }

    if (Schema.isFloat(type)) {
      if (isArray) return '[Float]';
      else return 'Float';
    }

    if (Schema.isObjectId(type)) {
      if (isArray) return '[ObjectID]';
      else return 'ObjectID';
    }

    if (Schema.isString(type)) {
      if (isArray) return '[String]';
      else return 'String';
    }

    if (Schema.isObject(type)) {
      if (isArray) return '[JSON]';
      else return 'JSON';
    }
  },
  isArray: (type: unknown): type is [unknown] => {
    if (typeof type === 'string') return type.includes('[') && type.includes(']');
    return Array.isArray(type) && type.length === 1;
  },
  isBoolean: (toCheck: unknown): boolean => {
    return toCheck === Boolean || toCheck === mongoose.Schema.Types.Boolean || toCheck === 'Boolean';
  },
  isDate: (toCheck: unknown): boolean => {
    return toCheck === Date || toCheck === mongoose.Schema.Types.Date || toCheck === 'Date';
  },
  isInt: (toCheck: unknown): boolean => {
    return toCheck === Number || toCheck === mongoose.Schema.Types.Number || toCheck === 'Number';
  },
  isFloat: (toCheck: unknown): boolean => {
    return toCheck === 'Float';
  },
  isObjectId: (toCheck: unknown): boolean => {
    return toCheck === mongoose.Types.ObjectId || toCheck === 'ObjectId' || toCheck === 'ObjectId';
  },
  isString: (toCheck: unknown): boolean => {
    return toCheck === String || toCheck === mongoose.Schema.Types.String || toCheck === 'String';
  },
  isObject: (toCheck: unknown): boolean => {
    return toCheck === JSON || toCheck === 'JSON';
  },
};

/**
 * Generates the types for the collection type definitions.
 */
function genTypes(
  schema: Array<[string, SchemaDefType | SchemaDef | SchemaRef | [SchemaDefType]]>,
  typeName: string,
  typeInheritance = undefined,
  customQueries: GenSchemaInput['customQueries'] = undefined
) {
  const schemaTop = schema.filter((field): field is [string, SchemaDef] => isSchemaDef(field[1]));
  const schemaTopRefs = schema.filter(([, fieldDef]) => isSchemaRef(fieldDef)) as Array<[string, SchemaRef]>;
  const schemaTopArrayDefType = schema.filter(
    (field): field is [string, [SchemaDefType]] => isSchemaDefOrType(field[1][0]) && !isSchemaDef(field[1][0])
  );
  const schemaNext = schema.filter(
    ([, fieldDef]) => isSchemaDefOrType(fieldDef) && !isSchemaDef(fieldDef)
  ) as Array<[string, SchemaDefType]>;

  return `
    type ${typeName} ${typeInheritance ? `inherits ${typeInheritance}` : ``} {
      ${
        // list the field and type for each schema definition
        schemaTop?.map(([fieldName, fieldDef]) => `${fieldName}: ${calcGraphFieldType(fieldDef)}`).join('\n')
      }
      ${
        // list the field and type for each schema reference
        schemaTopRefs
          ?.map(
            ([fieldName, fieldRef]) =>
              `${fieldName}: ${calcGraphFieldType({ type: fieldRef.fieldType, required: false })}`
          )
          .join('\n')
      }
      ${
        // list the field and type for each instance of a schema in an array
        schemaTopArrayDefType
          ?.map(([fieldName]) => `${fieldName}: [${typeName}${capitalize(fieldName)}]`)
          .join('\n')
      }
      ${
        // list the field and type for each set of nested schema definitions
        schemaNext?.map(([fieldName]) => `${fieldName}: ${typeName}${capitalize(fieldName)}`).join('\n')
      }
    }

    ${schemaTopArrayDefType
      ?.map((r) => {
        const fieldName = r[0];
        const schemaDefGroup = r[1][0];
        return genTypes(Object.entries(schemaDefGroup), `${typeName}${capitalize(fieldName)}`);
      })
      .join('\n')}

    ${schemaNext
      ?.map(([fieldName, schemaDef]) => {
        const isPublishableCollection = typeInheritance?.indexOf('PublishableCollection') === 0;
        const isPlainCollection = typeInheritance?.indexOf('Collection') === 0;
        const isPeopleField = fieldName === 'people';
        const isTimestampsField = fieldName === 'timestamps';
        const isPermissionsField = fieldName === 'permissions';

        let nextTypeInheritance: string;
        if (isPeopleField) {
          if (isPublishableCollection) nextTypeInheritance = `PublishableCollectionPeople`;
          else if (isPlainCollection) nextTypeInheritance = `CollectionPeople`;
        } else if (isTimestampsField) {
          if (isPublishableCollection) nextTypeInheritance = `PublishableCollectionTimestamps`;
          else if (isPlainCollection) nextTypeInheritance = `CollectionTimestamps`;
        } else if (isPermissionsField) {
          nextTypeInheritance = `CollectionPermissions`;
        }

        return genTypes(Object.entries(schemaDef), `${typeName}${capitalize(fieldName)}`, nextTypeInheritance);
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

/**
 * Generates the pruned types for the collection type definitions.
 */
function genPrunedTypes(
  schema: Array<[string, SchemaDefType | SchemaDef | SchemaRef | [SchemaDefType]]>,
  typeName: string,
  isPublishable: boolean
) {
  const schemaTopPublic = (
    schema.filter(([, fieldDef]) => isSchemaDef(fieldDef)) as Array<[string, SchemaDef]>
  ).filter(([, fieldDef]) => !!fieldDef.public);
  const schemaTopRefsPublic = schema
    .filter((field): field is [string, SchemaRef] => isSchemaRef(field[1]))
    .filter(([, fieldDef]) => !!fieldDef.public);
  const schemaTopArrayDefType = schema.filter(
    (field): field is [string, [SchemaDefType]] => isSchemaDefOrType(field[1][0]) && !isSchemaDef(field[1][0])
  );
  const schemaNext = schema.filter(
    (field): field is [string, SchemaDefType] => isSchemaDefOrType(field[1]) && !isSchemaDef(field[1])
  );

  return `
    type ${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName} {
      ${
        // list the field and type for each schema definition
        schemaTopPublic
          ?.map(([fieldName, fieldDef]) => `${fieldName}: ${calcGraphFieldType(fieldDef)}`)
          .join('\n') || `void: Void`
      }
      ${
        // list the field and type for each schema definition
        schemaTopRefsPublic
          ?.map(
            ([fieldName, fieldRef]) =>
              `${fieldName}: ${calcGraphFieldType({ type: fieldRef.fieldType, required: false })}`
          )
          .join('\n')
      }
      ${
        // list the field and type for each instance of a schema in an array
        schemaTopArrayDefType
          ?.map(([fieldName]) => `${fieldName}: [${typeName}${capitalize(fieldName)}]`)
          .join('\n')
      }
      ${
        // list the field and type for each set of nested schema definitions
        schemaNext
          ?.map(
            ([fieldName]) =>
              `${fieldName}: ${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName}${capitalize(fieldName)}`
          )
          .join('\n')
      }
    }

    ${schemaTopArrayDefType
      ?.map((r) => {
        const fieldName = r[0];
        const schemaDefGroup = r[1][0];
        return genTypes(Object.entries(schemaDefGroup), `${typeName}${capitalize(fieldName)}`);
      })
      .join('\n')}

    ${schemaNext
      ?.map(([fieldName, fieldDef]) => {
        if (isPublishable && fieldName === 'timestamps') {
          return genPrunedTypes(
            Object.entries({
              published_at: { type: 'Date', required: true, public: true },
              updated_at: { type: 'Date', required: true, public: true },
              ...fieldDef,
            }),
            `Pruned${typeName}Timestamps`,
            isPublishable
          );
        }

        const schema = Object.entries(fieldDef).filter(
          (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef] =>
            isSchemaDefOrType(schemaDefItem[1])
        );

        return genPrunedTypes(
          schema,
          `${typeName.includes(`Pruned`) ? `` : `Pruned`}${typeName}${capitalize(fieldName)}`,
          isPublishable
        );
      })
      .join('')}
  `;
}

/**
 * Generates the input types for the collection type definitions.
 */
function genInputs(
  schema: Array<[string, SchemaDefType | SchemaDef | [SchemaDefType]]>,
  typeName: string,
  typeInheritance = undefined
) {
  const schemaTop = schema
    .filter((field): field is [string, SchemaDef] => isSchemaDef(field[1]))
    .filter(([, fieldDef]) => fieldDef.modifiable);
  const schemaNext = schema.filter(
    (field): field is [string, SchemaDefType | [SchemaDefType]] => !isSchemaDef(field[1])
  );

  return `
    input ${typeName}${typeName.includes('ModifyInput') ? `` : `ModifyInput`} ${
    typeInheritance ? `inherits ${typeInheritance}` : ``
  } {
      ${
        // list the field and type for each schema definition
        schemaTop
          ?.map(
            ([fieldName, fieldDef]) =>
              `${fieldName}: ${calcGraphFieldType(fieldDef, { allOptional: true, useMongooseType: true })}`
          )
          .join('\n') || 'void: Void\n'
      }
      ${
        // list the field and type for each set of nested schema definitions
        schemaNext
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

    ${schemaNext
      ?.map(([fieldName, fieldDef]) => {
        // convert array field def into non-array field def
        if (Array.isArray(fieldDef)) {
          fieldDef = fieldDef[0];
        }

        // get the entries of the nested schemas
        let schema: [string, SchemaDef | NestedSchemaDefType][] = Object.entries(fieldDef).filter(
          (schemaDefItem): schemaDefItem is [string, NestedSchemaDefType | SchemaDef] =>
            isSchemaDefOrType(schemaDefItem[1])
        );

        if (fieldName === 'permissions') {
          const permissionsFieldDefs: NestedSchemaDefType = {
            users: { type: ['ObjectId'], modifiable: true },
            teams: { type: ['ObjectId'], modifiable: true },
          };
          schema.forEach(([key, value]) => {
            permissionsFieldDefs[key] = value;
          });
          schema = Object.entries(permissionsFieldDefs);
        }

        // generate input types for nested schemas
        return genInputs(
          schema,
          `${typeName}${typeName.includes('ModifyInput') ? `` : `ModifyInput`}${capitalize(fieldName)}`
        );
      })
      .join('')}
  `;
}

/**
 * Generates the query type definitions for the collection.
 */
function genQueries(
  typeName: string,
  oneAccessorName: string,
  oneAccessorType: string,
  manyAccessorName: string,
  manyAccessorType: string,
  customQueries: GenSchemaInput['customQueries'],
  options: GenSchemaInput['options'],
  usePublicQueries = false,
  usePublicBySlugQuery = false
): string {
  return `
    type Query {
      ${
        options?.disableFindOneQuery !== true
          ? `
              """
              Get a ${typeName} document by ${oneAccessorName}.
              """
              ${uncapitalize(typeName)}(${oneAccessorName}: ${oneAccessorType}): ${typeName}
            `
          : ``
      }
      ${
        options?.disableFindManyQuery !== true
          ? `
              """
              Get a set of ${typeName} documents by ${manyAccessorName}.
              If ${manyAccessorName} is omitted, the API will return all ${typeName} documents.
              """
              ${pluralize(
                uncapitalize(typeName)
              )}(${manyAccessorName}s: [${manyAccessorType}], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<${typeName}>  
            `
          : ``
      }
      ${
        options?.disableActionAccessQuery !== true
          ? `
              """
              Get the permissions of the currently authenticated user for the
              ${typeName} collection.
              """
              ${uncapitalize(typeName)}ActionAccess(_id: ObjectID): CollectionActionAccess
            `
          : ``
      }
      ${
        options?.disablePublicFindOneQuery !== true && usePublicQueries
          ? `
              """
              Get a pruned ${typeName} document by ${oneAccessorName}.
              """
              ${uncapitalize(typeName)}Public(${oneAccessorName}: ${oneAccessorType}): Pruned${typeName}
            `
          : ``
      }
      ${
        options?.disablePublicFindManyQuery !== true && usePublicQueries
          ? `
              """
              Get a set of pruned ${typeName} documents by ${manyAccessorName}.
              If ${manyAccessorName} is omitted, the API will return all ${typeName} documents.
              """
              ${pluralize(
                uncapitalize(typeName)
              )}Public(${manyAccessorName}s: [${manyAccessorType}], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<Pruned${typeName}>
            `
          : ``
      }
      ${
        options?.disablePublicFindOneBySlugQuery !== true && usePublicQueries && usePublicBySlugQuery
          ? `
              """
              Get a pruned ${typeName} document by ${oneAccessorName}.

              Provide the date of to ensure that the correct document is provided
              (in case the slug is not unique).
              """
              ${uncapitalize(typeName)}BySlugPublic(slug: String!, date: Date): Pruned${typeName}
            `
          : ``
      }

      ${
        customQueries
          ? customQueries
              .map((query) => {
                let name = uncapitalize(typeName) + capitalize(query.name);
                if (query.public === true) name += 'Public';

                const args = query.accepts;

                const manual = !query.returns.includes('{');
                if (manual) {
                  return `
            """
            ${query.description}
            """
            ${name}${args ? `(${args})` : ``}: ${query.returns}
            `;
                }

                const returnsArray = query.returns.includes('[') && query.returns.includes(']');
                return `
            """
            ${query.description}
            """
            ${name}${args ? `(${args})` : ``}: ${returnsArray ? `[${capitalize(name)}]` : capitalize(name)}
            `;
              })
              .join('\n')
          : ``
      }
    }
  `;
}

/**
 * Generates the mutation type definitions for the collection.
 */
function genMutations(
  schema: Array<[string, SchemaDefType | SchemaDef | [SchemaDefType]]>,
  typeName: string,
  oneAccessorName: string,
  oneAccessorType: string,
  canPublish: boolean,
  customMutations: GenSchemaInput['customMutations'],
  options: GenSchemaInput['options'],
  modifyInputType?: string
): string {
  const createString = () => {
    const schemaTop = schema.filter((field): field is [string, SchemaDef] => isSchemaDef(field[1]));

    // list the modifiable top-level fields
    const fieldString = schemaTop
      .filter(([, fieldDef]) => fieldDef.modifiable)
      .map(
        ([fieldName, fieldDef]) =>
          `${fieldName}: ${calcGraphFieldType(fieldDef, { optionalInitial: true, useMongooseType: true })}`
      )
      .join(', ');

    // if this is a user document, also add option to specify username
    if (typeName === 'User') return fieldString + ', username: String!';

    return fieldString;
  };

  return `
    type Mutation {
      ${
        options?.disableCreateMutation !== true
          ? `
              """
              Create a new ${typeName} document.
              """
              ${uncapitalize(typeName)}Create(${createString()}): ${typeName}
            `
          : ``
      }
      ${
        options?.disableModifyMutation !== true
          ? `
              """
              Modify an existing ${typeName} document.
              """
              ${uncapitalize(typeName)}Modify(${oneAccessorName}: ${oneAccessorType}, input: ${
              modifyInputType ? modifyInputType : `${typeName}ModifyInput!`
            }): ${typeName}
            `
          : ``
      }
      ${
        options?.disableHideMutation !== true
          ? `
              """
              Set whether an existing ${typeName} document is hidden.
        
              This mutation sets hidden: true by default.
        
              Hidden ${typeName} documents should not be presented to clients;
              this is analogous to moving the document to a deleted items folder
              """
              ${uncapitalize(typeName)}Hide(${oneAccessorName}: ${oneAccessorType}, hide: Boolean): ${typeName}
            `
          : ``
      }
      ${
        options?.disableLockMutation !== true
          ? `
              """
              Set whether an existing ${typeName} document is locked.
        
              This mutation sets locked: true by default.
        
              Locked ${typeName} documents should only be editable by the server
              and by admins.
              """
              ${uncapitalize(typeName)}Lock(${oneAccessorName}: ${oneAccessorType}, lock: Boolean): ${typeName}
            `
          : ``
      }
      ${
        options?.disableWatchMutation !== true
          ? `
              """
              Add a watcher to a ${typeName} document.
        
              This mutation adds the watcher by default. If a user _id is
              not specified, for the watcher, the currently authenticated user will
              be used.
              """
              ${uncapitalize(
                typeName
              )}Watch(${oneAccessorName}: ${oneAccessorType}, watcher: ObjectID, watch: Boolean): ${typeName}
            `
          : ``
      }
      ${
        options?.disableDeleteMutation !== true
          ? `
              """
              Deletes a ${typeName} document.
              """
              ${uncapitalize(typeName)}Delete(${oneAccessorName}: ${oneAccessorType}): Void
            `
          : ``
      }
      ${
        options?.disablePublishMutation !== true && canPublish
          ? `
              """
              Publishes an existing ${typeName} document.
              """
              ${uncapitalize(
                typeName
              )}Publish(${oneAccessorName}: ${oneAccessorType}, published_at: Date, publish: Boolean): ${typeName}
            `
          : ``
      }
      ${
        customMutations
          ? customMutations
              .map((mutation) => {
                let name = uncapitalize(typeName) + capitalize(mutation.name);
                if (mutation.public === true) name += 'Public';

                if (hasKey('inc', mutation.action)) {
                  const inc = `inc${capitalize(mutation.action.inc[0])}`;
                  return `
                    """
                    ${mutation.description}
                    """
                    ${name}(_id: ObjectID!, ${inc}: ${mutation.action.inc[1]}!): ${typeName}
                  `;
                }
              })
              .join('\n')
          : ``
      }
    }
  `;
}

/**
 * Generates the subscription type definitions for the collection.
 */
function genSubscriptions(
  typeName: string,
  oneAccessorName: string,
  oneAccessorType: string,
  options: GenSchemaInput['options']
): string {
  return `extend type Subscription {
    ${
      options?.disableCreatedSubscription !== true
        ? `
            """
            Sends a ${typeName} document when it is created.
            """
            ${uncapitalize(typeName)}Created(): ${typeName}
          `
        : ``
    }
    ${
      options?.disableModifiedSubscription !== true
        ? `
            """
            Sends the updated ${typeName} document when it changes.
        
            If ${oneAccessorName} is omitted, the server will send changes for all shorturls.
            """
            ${uncapitalize(typeName)}Modified(${oneAccessorName}: ${oneAccessorType.replace(
            '!',
            ''
          )}): ${typeName}
          `
        : ``
    }
    ${
      options?.disableDeletedSubscription !== true
        ? `
            """
            Sends a ${typeName} ${oneAccessorName} when it is deleted.
        
            If ${oneAccessorName} is omitted, the server will send ${oneAccessorName}s for all deleted ${typeName}
            documents.
            """
            ${uncapitalize(typeName)}Deleted(${oneAccessorName}: ${oneAccessorType.replace(
            '!',
            ''
          )}): ${oneAccessorType}
          `
        : ``
    }
  }`;
}

export { genTypeDefs, calcAccessor, Schema };
