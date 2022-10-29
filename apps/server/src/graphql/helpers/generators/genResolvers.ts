import {
  calcAccessor,
  deconstructSchema,
  defaultSchemaDefTypes,
  GenSchemaInput,
  isCustomGraphSchemaType,
  isSchemaDef,
  isSchemaDefOrType,
  isSchemaRef,
  isTypeTuple,
  MongooseSchemaType,
  SchemaDef,
  SchemaDefType,
  SchemaRef,
} from '@jackbuehner/cristata-generator-schema';
import {
  capitalize,
  dateAtTimeZero,
  flattenObject,
  hasKey,
  isObjectId,
  uncapitalize,
} from '@jackbuehner/cristata-utils';
import { ApolloError, UserInputError } from 'apollo-server-errors';
import { findAndReplace } from 'find-and-replace-anything';
import getFieldNames from 'graphql-list-fields';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { get as getProperty } from 'object-path';
import pluralize from 'pluralize';
import { CollectionDoc, Helpers } from '..';
import { TenantDB } from '../../../mongodb/TenantDB';
import { collectionPeopleResolvers, Context, publishableCollectionPeopleResolvers } from '../../server';
import { constructDocFromRef } from './constructDocFromRef';

type Info = Parameters<typeof getFieldNames>[0];

async function construct(
  doc: CollectionDoc | null | undefined,
  schemaRefs: [string, SchemaRef][],
  context: Context,
  info: Info,
  helpers: Helpers
) {
  if (doc === null || doc === undefined) return null;

  // construct a document that includes
  // all referenced fields
  let constructedDoc = doc;
  await schemaRefs.reduce(
    async (promise, [fieldName, refSpec]) => {
      // wait for the last async function to finish.
      await promise;
      constructedDoc = await constructDocFromRef({
        parentDoc: constructedDoc,
        model: refSpec.model,
        by: refSpec.by,
        from: refSpec.matches,
        field: refSpec.field,
        to: fieldName,
        context,
      });
    },
    // use an already resolved Promise for the first iteration,
    Promise.resolve()
  );

  // reference user objects instead of user ids
  if (constructedDoc && constructedDoc.permissions) {
    const fields = getFieldNames(info)
      .map((field) => field.replace('docs.', ''))
      .filter((field) => field.indexOf('permissions.users.') === 0)
      .map((field) => field.replace('permissions.users.', ''));

    return merge(constructedDoc, {
      permissions: { users: await helpers.getUsers(constructedDoc.permissions.users || [], context, fields) },
    });
  }

  return constructedDoc;
}

/**
 * Creates a projection that only fetches the document fields
 * requested in the GraphQL query.
 *
 * We do not worry about values required in fields' setters
 * since this is only run on the API server.
 * All changes on this server also go to the hocuspocus server,
 * which will handle the setters.
 */
function createProjection(
  info: Info,
  config: {
    schemaDef: GenResolversInput['schemaDef'];
    canPublish: GenResolversInput['canPublish'];
    withPermissions: GenResolversInput['withPermissions'];
  }
) {
  // ensure we include the common schema defs
  const fullSchema = merge<SchemaDefType, SchemaDefType[]>(
    config.schemaDef || {},
    defaultSchemaDefTypes.standard,
    config.canPublish ? defaultSchemaDefTypes.publishable : {},
    config.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
  );

  const deconstructedSchema = deconstructSchema(fullSchema);

  // determine the names of the fields that are references/objectids
  const objectIdFields = deconstructedSchema
    .map(([key, def]): [string, MongooseSchemaType | 'DocArray', boolean] => {
      const [schemaType, isArray] = (() => {
        const schemaType: MongooseSchemaType | 'DocArray' = isTypeTuple(def.type) ? def.type[1] : def.type;
        const isArrayType = Array.isArray(schemaType);

        if (isArrayType) return [schemaType[0], true];
        return [schemaType, false];
      })();

      return [key, schemaType, isArray];
    })
    .filter(([, schemaType]) => {
      return schemaType === 'ObjectId';
    })
    .map(([key]) => key);

  // get the names of the requested fields
  let fields = getFieldNames(info).map((field) => field.replace('docs.', ''));

  // remove fields that are referenced values that the database does not see
  // (the database only has the _id, and graphql pulls them together)
  // and then add the root field with the _id
  objectIdFields.forEach((idField) => {
    if (fields.find((field) => field.indexOf(idField) === 0)) {
      fields = [...fields.filter((field) => field.indexOf(idField) !== 0), idField];
    }
  });

  const projection: Record<string, 1> = {};
  fields.forEach((field) => {
    projection[field] = 1;
  });

  return projection;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function genResolvers(config: GenResolversInput, tenant: string) {
  const { name, helpers, options } = config;
  const publicRules = findAndReplace(config.publicRules, `Date.now()`, new Date());
  const [oneAccessorName, oneAccessorType] = calcAccessor('one', config.by);
  const hasPublic = JSON.stringify(config.schemaDef).includes(`"public":true`);
  const hasSlug = hasKey('slug', config.schemaDef) && (config.schemaDef.slug as SchemaDef).type === 'String';
  const schemaRefs = Object.entries(config.schemaDef).filter(([, fieldDef]) => isSchemaRef(fieldDef)) as Array<
    [string, SchemaRef]
  >;

  const Query: ResolverType = {};

  if (options?.disableFindOneQuery !== true) {
    /**
     * Finds a single document by the accessor specified in the config.
     */
    Query[uncapitalize(name)] = async (parent, args, context, info) => {
      const doc = await helpers.findDoc({
        model: name,
        by: oneAccessorName,
        _id:
          oneAccessorType.replace('!', '') === 'Date' ? new Date(args[oneAccessorName]) : args[oneAccessorName],
        context,
        project: createProjection(info, config),
      });
      return await construct(doc, schemaRefs, context, info, helpers);
    };
  }

  if (options?.disableFindManyQuery !== true) {
    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     */
    Query[pluralize(uncapitalize(name))] = async (parent, args, context, info) => {
      const { docs, ...paged }: { docs: CollectionDoc[] } = await helpers.findDocs({
        model: name,
        args,
        context,
        project: createProjection(info, config),
      });
      return {
        ...paged,
        docs: await Promise.all(docs.map((doc) => construct(doc, schemaRefs, context, info, helpers))),
      };
    };
  }

  if (options?.disableActionAccessQuery !== true) {
    /**
     * Get the action access ofor the collection.
     */
    Query[`${uncapitalize(name)}ActionAccess`] = async (parent, args, context) => {
      return await helpers.getCollectionActionAccess({ model: name, context, args });
    };
  }

  if (options?.disablePublicFindOneQuery !== true && hasPublic && publicRules !== false) {
    Query[`${uncapitalize(name)}Public`] = async (parent, args, context, info) => {
      return await construct(
        await helpers.findDoc({
          model: name,
          by: oneAccessorName,
          _id:
            oneAccessorType.replace('!', '') === 'Date'
              ? new Date(args[oneAccessorName])
              : args[oneAccessorName],
          filter: publicRules.filter,
          context,
          fullAccess: true,
          project: createProjection(info, config),
        }),
        schemaRefs,
        context,
        info,
        helpers
      );
    };
  }

  if (options?.disablePublicFindManyQuery !== true && hasPublic && publicRules !== false) {
    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     *
     * This query is for the Pruned document type, which disallows getting
     * fields unless they are marked `public: true`.
     */
    Query[`${pluralize(uncapitalize(name))}Public`] = async (parent, args, context, info) => {
      const { docs, ...paged }: { docs: CollectionDoc[] } = await helpers.findDocs({
        model: name,
        args: { ...args, filter: { ...args.filter, ...publicRules.filter } },
        context,
        fullAccess: true,
      });
      return {
        ...paged,
        docs: await Promise.all(docs.map((doc) => construct(doc, schemaRefs, context, info, helpers))),
      };
    };
  }

  if (options?.disablePublicFindOneBySlugQuery !== true && hasPublic && publicRules !== false && hasSlug) {
    /**
     * Finds a single document by slug and optional date.
     *
     * This query is for the Pruned document type, which disallows getting
     * fields unless they are marked `public: true`.
     */
    Query[`${uncapitalize(name)}BySlugPublic`] = async (parent, args, context, info) => {
      // create filter to find newest document with matching slug
      const filter =
        args.date && publicRules.slugDateField
          ? {
              [publicRules.slugDateField]: {
                $gte: dateAtTimeZero(args.date),
                $lt: new Date(dateAtTimeZero(args.date).getTime() + 24 * 60 * 60 * 1000),
              },
              ...publicRules.filter,
            }
          : publicRules.filter;

      // get the doc
      const doc = await helpers.findDoc({
        model: name,
        by: 'slug',
        _id: args.slug,
        filter,
        context,
        fullAccess: true,
        project: createProjection(info, config),
      });

      // return a fully constructed doc
      return await construct(doc, schemaRefs, context, info, helpers);
    };
  }

  if (config.customQueries) {
    config.customQueries.forEach((query) => {
      let customQueryName = uncapitalize(name) + capitalize(query.name);
      if (query.public === true) customQueryName += 'Public';

      Query[customQueryName] = async (parent, args, context) => {
        if (query.public !== true) {
          helpers.requireAuthentication(context);
        }

        const tenantDB = new TenantDB(tenant, context.config.collections);
        await tenantDB.connect();
        const Model = await tenantDB.model<CollectionDoc>(name);

        const argNames = query.accepts?.split(',').map((field) => field.split(':')[0]) || [];

        let populatedPipline = query.pipeline;
        argNames.forEach((name) => {
          populatedPipline = findAndReplace(populatedPipline, `%${name}%`, args[name]);
        });

        const aggregate = await Model?.aggregate(populatedPipline);

        if (query.path) return getProperty(aggregate || [], query.path);
        return aggregate;
      };
    });
  }

  const Mutation: ResolverType = {};

  if (options?.disableCreateMutation !== true) {
    Mutation[`${uncapitalize(name)}Create`] = async (parent, args, context) => {
      // check input rules
      Object.keys(flattenObject(args)).forEach((key) => {
        const inputRule: SchemaDef['rule'] = getProperty(config.schemaDef, key)?.rule;
        if (inputRule) {
          const match = getProperty(args, key)?.match(
            new RegExp(inputRule.regexp.pattern, inputRule.regexp.flags)
          );
          if (match === null || match === undefined) throw new UserInputError(inputRule.message);
        }
      });

      return await helpers.createDoc<mongoose.LeanDocument<mongoose.Document>>({
        model: name,
        args,
        context,
        withPermissions: config.withPermissions,
      });
    };

    Mutation[`${uncapitalize(name)}Clone`] = async (parent, args, context) => {
      // check input rules
      Object.keys(flattenObject(args)).forEach((key) => {
        const inputRule: SchemaDef['rule'] = getProperty(config.schemaDef, key)?.rule;
        if (inputRule) {
          const match = getProperty(args, key)?.match(
            new RegExp(inputRule.regexp.pattern, inputRule.regexp.flags)
          );
          if (match === null || match === undefined) throw new UserInputError(inputRule.message);
        }
      });

      const accessor = { key: oneAccessorName, value: args[oneAccessorName] };

      return await helpers.cloneDoc({ model: name, accessor, context });
    };
  }

  if (options?.disableModifyMutation !== true) {
    Mutation[`${uncapitalize(name)}Modify`] = async (
      parent,
      { [oneAccessorName]: _accessor, input },
      context
    ) => {
      // check input rules
      Object.keys(flattenObject({ [oneAccessorName]: _accessor, input } as never)).forEach((key) => {
        const inputRule: SchemaDef['rule'] = getProperty(input.schemaDef, key)?.rule;
        if (inputRule) {
          const match = getProperty({ [oneAccessorName]: _accessor, input }, key)?.match(
            new RegExp(inputRule.regexp.pattern, inputRule.regexp.flags)
          );
          if (match === null || match === undefined) throw new UserInputError(inputRule.message);
        }
      });

      return await helpers.modifyDoc<mongoose.Document, mongoose.LeanDocument<mongoose.Document>>({
        model: name,
        data: { ...input, [oneAccessorName]: _accessor },
        _id: oneAccessorType.replace('!', '') === 'Date' ? new Date(_accessor) : _accessor,
        by: oneAccessorName,
        context,
      });
    };
  }

  if (options?.disableHideMutation !== true) {
    Mutation[`${uncapitalize(name)}Hide`] = async (parent, args, context) => {
      const accessor = { key: oneAccessorName, value: args[oneAccessorName] };

      return await helpers.hideDoc({ model: name, accessor, hide: args.hide, context });
    };
  }

  if (options?.disableArchiveMutation !== true) {
    Mutation[`${uncapitalize(name)}Archive`] = async (parent, args, context) => {
      const accessor = { key: oneAccessorName, value: args[oneAccessorName] };

      return await helpers.archiveDoc({ model: name, accessor, archive: args.archive, context });
    };
  }

  if (options?.disableLockMutation !== true) {
    Mutation[`${uncapitalize(name)}Lock`] = async (parent, args, context) => {
      const accessor = { key: oneAccessorName, value: args[oneAccessorName] };

      return await helpers.lockDoc({ model: name, accessor, lock: args.lock, context });
    };
  }

  if (options?.disableWatchMutation !== true) {
    Mutation[`${uncapitalize(name)}Watch`] = async (parent, args, context) => {
      const accessor = { key: oneAccessorName, value: args[oneAccessorName] };

      return await helpers.watchDoc({
        model: name,
        accessor,
        watch: args.watch,
        watcher: args.watcher,
        context,
      });
    };
  }

  if (options?.disableDeleteMutation !== true) {
    Mutation[`${uncapitalize(name)}Delete`] = async (parent, args, context) => {
      return await helpers.deleteDoc({ model: name, args, context });
    };
  }

  if (options?.disablePublishMutation !== true && config.canPublish) {
    Mutation[`${uncapitalize(name)}Publish`] = async (parent, args, context) => {
      const by = oneAccessorName;
      const _id = oneAccessorType.replace('!', '') === 'Date' ? new Date(args[by]) : args[oneAccessorName];
      return await helpers.publishDoc({ model: name, args, context, by, _id });
    };
  }

  if (config.customMutations) {
    config.customMutations.forEach((mutation) => {
      let customMutationName = uncapitalize(name) + capitalize(mutation.name);
      if (mutation.public === true) customMutationName += 'Public';

      Mutation[customMutationName] = async (parent, args, context) => {
        if (mutation.public !== true) {
          helpers.requireAuthentication(context);
        }

        if (hasKey('inc', mutation.action)) {
          const doc = await helpers.findDoc({
            model: name,
            _id: args._id,
            context,
            fullAccess: true,
            lean: false,
            project: { [mutation.action.inc[0]]: 1 },
          });
          if (doc) {
            doc[mutation.action.inc[0]] += args[`inc${capitalize(mutation.action.inc[0])}`];
            return doc.save();
          }
          return doc;
        }
      };
    });
  }

  const baselineResolvers = { Query, Mutation };

  const customResolvers = genCustomResolvers(config, tenant);

  return { ...baselineResolvers, ...customResolvers };
}

type ResolverType = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (parent: unknown, args: any, context: Context, info: Info) => Promise<unknown | unknown[]>
>;
function genCustomResolvers(input: GenResolversInput, tenant: string): ResolverType {
  const hasPublic = JSON.stringify(input.schemaDef).includes(`"public":true`);

  /**
   * @param isPublic whether non-public fields need to be filtered away
   */
  const gen = (parentName: string, schemaDef: SchemaDefType, isPublic?: boolean) => {
    // only store schema defs that have defined a custom graphql type, which
    // requires a custom resolver (e.g. '[Users]')
    let schemaDefsWithCustomGraphType = Object.entries(schemaDef).filter(
      ([, def]) => isSchemaDef(def) && isTypeTuple(def.type) && isCustomGraphSchemaType(def.type[0])
    ) as unknown as Array<[string, SchemaDefsWithCustomGraphType]>;

    // if the generator is generating custom resolvers for Pruned types,
    // remove schema entries that are not available publically
    if (isPublic)
      schemaDefsWithCustomGraphType = schemaDefsWithCustomGraphType.filter(([, fieldDef]) => !!fieldDef.public);

    // generate a custom resolver
    const customResolver = {
      [parentName]: merge(
        {},
        ...schemaDefsWithCustomGraphType.map(([fieldName, def]) => {
          // if the provided type is an array type, get a matching document for
          // each element of the array
          if (def.type[0][0] === '[' && def.type[0].slice(-1) === ']') {
            return {
              /**
               * Get an array of documents from a collection by their _id.
               * The _ids are in the provided in `parent[fieldName]`, and this function
               * resolves each _id into a document from the specified collection.
               *
               * The collection is considered to be the name of the type.
               */
              [fieldName]: async (
                parent: { [x: string]: unknown[] },
                args: never,
                context: Context,
                info: Info
              ) => {
                const tenantDB = new TenantDB(tenant, context.config.collections);
                await tenantDB.connect();

                // get the model from the type
                // * the provided type MUST be the name of a model (sans square brackets)
                const modelName = def.type[0].replace('[', '').replace(']', '');
                const Model = await tenantDB.model(modelName);

                // if the model does not exist, return a schema error
                if (!Model)
                  throw new ApolloError(
                    'custom GraphSchemaType string must match the name of a collection model',
                    'SCHEMA_ERROR',
                    { invalidName: def.type[0] }
                  );

                // get the field value
                let fieldValue = parent[fieldName] || [];

                // ensure the value of the field is an array
                const isArray = Array.isArray(fieldValue);
                if (!isArray) fieldValue = [fieldValue];

                // filter out null values
                fieldValue = fieldValue.filter((elem: unknown) => !!elem);

                // ensure every element in the field is an ObjectID
                const containsOnlyValidObjectIds = fieldValue.every((elem: unknown) => isObjectId(elem));
                if (!containsOnlyValidObjectIds)
                  throw new ApolloError(
                    'the referenced field contains values that are not valid ObjectIds',
                    'VALUE_ERROR',
                    {
                      field: { name: fieldName, values: fieldValue },
                    }
                  );

                // calculate a projection so we do not need to load unused fields
                const projection = createProjection(info, input);
                const isOnlyId = (() => {
                  const keys = Object.keys(projection);
                  return keys.length === 1 && keys[0] === '_id';
                })();

                // get the documents from their collection
                const promises = fieldValue.map(async (_id) => {
                  if (isOnlyId) return { _id }; // do not query if we only need _id
                  return await Model.findById(_id, projection);
                });

                // wait for them to all resolve
                const docs = await Promise.all(promises);
                return docs;
              },
            };
          }

          // otherwise, the provided type is not an array, so only get
          // a single matching document
          return {
            /**
             * Get an array of documents from a collection by their _id.
             * The _ids are in the provided in `parent[fieldName]`, and this function
             * resolves each _id into a document from the specified collection.
             *
             * The collection is considered to be the name of the type.
             */
            [fieldName]: async (
              parent: { [x: string]: unknown },
              args: never,
              context: Context,
              info: Info
            ) => {
              const tenantDB = new TenantDB(tenant, context.config.collections);
              await tenantDB.connect();

              // get the model from the type
              // * the provided type MUST be the name of a model (sans square brackets)
              const modelName = def.type[0].replace('[', '').replace(']', '');
              const Model = await tenantDB.model(modelName);

              // if the model does not exist, return a schema error
              if (!Model)
                throw new ApolloError(
                  'custom GraphSchemaType string must match the name of a collection model',
                  'SCHEMA_ERROR',
                  { invalidName: def.type[0] }
                );

              // if the value is undefined, return null
              if (parent[fieldName] === undefined || parent[fieldName] === null) return null;

              // if null, return null
              if (parent[fieldName] === null) return null;

              // ensure the field value is an ObjectId
              const valueIsObjectId = isObjectId(parent[fieldName]);
              if (!valueIsObjectId)
                throw new ApolloError('the referenced field does not contain a valid ObjectId', 'VALUE_ERROR', {
                  field: { name: fieldName, value: parent[fieldName] },
                });

              // calculate a projection so we do not need to load unused fields
              const projection = createProjection(info, input);
              const isOnlyId = (() => {
                const keys = Object.keys(projection);
                return keys.length === 1 && keys[0] === '_id';
              })();

              // do not query if we only need _id
              if (isOnlyId) {
                return { _id: parent[fieldName] };
              }

              // get the document from its collection
              const doc = await Model.findById(parent[fieldName]);
              return doc;
            },
          };
        })
      ),
    } as ResolverType;

    // identify the nested schemas
    const nestedSchemaDefs = Object.entries(schemaDef).filter(
      ([, def]) => isSchemaDefOrType(def) && !isSchemaDef(def)
    ) as Array<[string, SchemaDefType]>;

    // generate custom resolvers for the nested schemas
    const nestedCustomResolvers = merge(
      {},
      ...nestedSchemaDefs.map(([name, nestedSchemaDef]) => {
        let obj = {};

        // include baseline people resolvers if it is for people
        if (name === 'people' && isPublic !== true) {
          if (input.canPublish)
            obj = { ...obj, [input.name + 'People']: { ...publishableCollectionPeopleResolvers } };
          else obj = { ...obj, [input.name + 'People']: { ...collectionPeopleResolvers } };
        }

        return merge(
          obj,
          // send nested schemea through this function to generate the resolvers
          gen(name.indexOf(input.name) === 0 ? '' : parentName + capitalize(name), nestedSchemaDef, isPublic)
        );
      })
    ) as ResolverType;

    // return empty object for undefined resolvers
    if (customResolver[parentName] === undefined) {
      return {};
    }

    return { ...customResolver, ...nestedCustomResolvers };
  };

  // generate for normal and public queries
  const normal = gen(input.name, input.schemaDef);
  const pruned = hasPublic ? gen('Pruned' + input.name, input.schemaDef, true) : {};
  return { ...normal, ...pruned };
}

interface GenResolversInput extends GenSchemaInput {
  helpers: Helpers;
}

interface SchemaDefsWithCustomGraphType extends Omit<SchemaDef, 'type'> {
  type: string;
}

export type { GenResolversInput };
export { genResolvers };
