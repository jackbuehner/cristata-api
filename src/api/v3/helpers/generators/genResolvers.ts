import { CollectionDoc, Helpers } from '..';
import {
  collectionPeopleResolvers,
  Context,
  publishableCollectionPeopleResolvers,
  pubsub,
} from '../../../../apollo';
import mongoose from 'mongoose';
import {
  GenSchemaInput,
  isCustomGraphSchemaType,
  isSchemaDef,
  isSchemaDefOrType,
  isSchemaRef,
  isTypeTuple,
  SchemaDef,
  SchemaDefType,
  SchemaRef,
} from './genSchema';
import { calcAccessor } from './genTypeDefs';
import { merge } from 'merge-anything';
import { capitalize } from '../../../../utils/capitalize';
import { uncapitalize } from '../../../../utils/uncapitalize';
import { hasKey } from '../../../../utils/hasKey';
import { dateAtTimeZero } from '../../../../utils/dateAtTimeZero';
import { findAndReplace } from 'find-and-replace-anything';
import { conditionallyModifyDocField } from './conditionallyModifyDocField';
import { constructDocFromRef } from './constructDocFromRef';
import { get as getProperty } from 'object-path';
import { ApolloError, UserInputError } from 'apollo-server-errors';
import { flattenObject } from '../../../../utils/flattenObject';
import { isObjectId } from '../../../../utils/isObjectId';
import pluralize from 'pluralize';

async function construct(doc: mongoose.Document | null, schemaRefs: [string, SchemaRef][], context: Context) {
  if (doc === null) return null;

  // construct a document that includes
  // all referenced fields
  let constructedDoc = doc.toObject?.() || doc;
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

  return constructedDoc;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function genResolvers({ name, helpers, ...input }: GenResolversInput) {
  const [oneAccessorName] = calcAccessor('one', input.by);
  const hasPublic = JSON.stringify(input.schemaDef).includes(`"public":true`);
  const hasSlug =
    hasKey('slug', input.schemaDef) &&
    ((input.schemaDef.slug as SchemaDef).type === String ||
      (input.schemaDef.slug as SchemaDef).type === mongoose.Schema.Types.String);
  const schemaRefs = Object.entries(input.schemaDef).filter(([, fieldDef]) => isSchemaRef(fieldDef)) as Array<
    [string, SchemaRef]
  >;

  const Query = {
    /**
     * Finds a single document by the accessor specified in the config.
     */
    [uncapitalize(name)]: async (parent, args, context: Context) => {
      const doc = await helpers.findDoc({
        model: name,
        by: oneAccessorName,
        _id: args[oneAccessorName],
        context,
      });
      return await construct(doc, schemaRefs, context);
    },
    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     */
    [pluralize(uncapitalize(name))]: async (parent, args, context: Context) => {
      const { docs, ...paged }: { docs: mongoose.Document[] } = await helpers.findDocs({
        model: name,
        args,
        context,
      });
      return {
        ...paged,
        docs: await Promise.all(docs.map((doc) => construct(doc, schemaRefs, context))),
      };
    },
    /**
     * Get the action access ofor the collection.
     */
    [`${uncapitalize(name)}ActionAccess`]: async (parent, args, context: Context) => {
      return await helpers.getCollectionActionAccess({ model: name, context, args });
    },
  } as c;

  const { publicRules } = input;
  if (hasPublic && publicRules !== false) {
    /**
     * Finds a single document by the accessor specified in the config.
     *
     * This query is for the Pruned document type, which disallows getting
     * fields unless they are marked `public: true`.
     */
    Query[`${uncapitalize(name)}Public`] = (async (parent, args, context: Context) => {
      return await construct(
        await helpers.findDoc({
          model: name,
          by: oneAccessorName,
          _id: args[oneAccessorName],
          filter: publicRules.filter,
          context,
          fullAccess: true,
        }),
        schemaRefs,
        context
      );
    }) as unknown as (doc: never) => Promise<never[]>;

    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     *
     * This query is for the Pruned document type, which disallows getting
     * fields unless they are marked `public: true`.
     */
    Query[`${pluralize(uncapitalize(name))}Public`] = (async (parent, args, context: Context) => {
      const { docs, ...paged }: { docs: mongoose.Document[] } = await helpers.findDocs({
        model: name,
        args: { ...args, filter: { ...args.filter, ...publicRules.filter } },
        context,
        fullAccess: true,
      });
      return {
        ...paged,
        docs: await Promise.all(docs.map((doc) => construct(doc, schemaRefs, context))),
      };
    }) as unknown as (doc: never) => Promise<never[]>;

    if (hasSlug && publicRules.slugDateField) {
      /**
       * Finds a single document by slug and optional date.
       *
       * This query is for the Pruned document type, which disallows getting
       * fields unless they are marked `public: true`.
       */
      Query[`${uncapitalize(name)}BySlugPublic`] = (async (parent, args, context: Context) => {
        // create filter to find newest document with matching slug
        const filter = args.date
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
        });

        // return a fully constructed doc
        return await construct(doc, schemaRefs, context);
      }) as unknown as (doc: never) => Promise<never[]>;
    }
  }

  if (input.customQueries) {
    input.customQueries.forEach((query) => {
      const customQueryName = uncapitalize(name) + capitalize(query.name);

      Query[customQueryName] = (async (parent, args, context: Context) => {
        helpers.requireAuthentication(context);

        const Model = mongoose.model<CollectionDoc>(name);
        const argNames = query.accepts?.split(',').map((field) => field.split(':')[0]) || [];

        let populatedPipline = query.pipeline;
        argNames.forEach((name) => {
          populatedPipline = findAndReplace(populatedPipline, `%${name}%`, args[name]);
        });

        return await Model.aggregate(populatedPipline);
      }) as unknown as (doc: never) => Promise<never[]>;
    });
  }

  const gc = { name, helpers, ...input };
  const Mutation = {
    [`${uncapitalize(name)}Create`]: async (parent, args, context: Context) => {
      // check input rules
      Object.keys(flattenObject(args)).forEach((key) => {
        const inputRule: SchemaDef['rule'] = getProperty(gc.schemaDef, key)?.rule;
        if (inputRule) {
          const match = getProperty(args, key)?.match(inputRule.match);
          if (match === null || match === undefined) throw new UserInputError(inputRule.message);
        }
      });

      return await helpers.withPubSub(
        name.toUpperCase(),
        'CREATED',
        helpers.createDoc<mongoose.LeanDocument<mongoose.Document>>({
          model: name,
          args,
          context,
          withPermissions: input.withPermissions,
          modify: async (currentDoc, data) => {
            conditionallyModifyDocField(currentDoc, data, gc);
          },
        })
      );
    },
    [`${uncapitalize(name)}Modify`]: async (parent, { _id, input }, context: Context) => {
      // check input rules
      Object.keys(flattenObject({ _id, input } as never)).forEach((key) => {
        const inputRule: SchemaDef['rule'] = getProperty(gc.schemaDef, key)?.rule;
        if (inputRule) {
          const match = getProperty({ _id, input }, key)?.match(inputRule.match);
          if (match === null || match === undefined) throw new UserInputError(inputRule.message);
        }
      });

      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.modifyDoc<mongoose.Document, mongoose.LeanDocument<mongoose.Document>>({
          model: name,
          data: { ...input, _id },
          context,
          modify: async (currentDoc, data) => {
            conditionallyModifyDocField(currentDoc, data, gc);
          },
        })
      );
    },
    [`${uncapitalize(name)}Hide`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.hideDoc({ model: name, args, context })
      );
    },
    [`${uncapitalize(name)}Lock`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.lockDoc({ model: name, args, context })
      );
    },
    [`${uncapitalize(name)}Watch`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.watchDoc({ model: name, args, context })
      );
    },
    [`${uncapitalize(name)}Delete`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'DELETED',
        helpers.deleteDoc({ model: name, args, context })
      );
    },
  } as c;

  if (input.canPublish) {
    Mutation[`${uncapitalize(name)}Publish`] = (async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'DELETED',
        helpers.publishDoc({ model: name, args, context })
      );
    }) as (doc: never) => Promise<never[]>;
  }

  const Subscription = {
    [`${uncapitalize(name)}Created`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_CREATED`]),
    },
    [`${uncapitalize(name)}Modified`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_MODIFIED`]),
    },
    [`${uncapitalize(name)}Deleted`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_DELETED`]),
    },
  };

  const baselineResolvers = { Query, Mutation, Subscription };
  if (!input.withSubscription) delete baselineResolvers.Subscription;

  const customResolvers = genCustomResolvers({ name, helpers, ...input });

  return { ...baselineResolvers, ...customResolvers };
}

type c = Record<string, (doc: never) => Promise<never[]>>;
function genCustomResolvers(input: GenResolversInput): c {
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
              [fieldName]: async (parent) => {
                // get the model from the type
                // * the provided type MUST be the name of a model (sans square brackets)
                const modelName = def.type[0].replace('[', '').replace(']', '');
                const Model = mongoose.model(modelName);

                // if the model does not exist, return a schema error
                if (!Model)
                  throw new ApolloError(
                    'custom GraphSchemaType string must match the name of a collection model',
                    'SCHEMA_ERROR',
                    { invalidName: def.type[0] }
                  );

                // ensure every element in the field is an ObjectID
                const containsOnlyValidObjectIds = parent[fieldName].every((elem: unknown) => isObjectId(elem));
                if (!containsOnlyValidObjectIds)
                  throw new ApolloError(
                    'the referenced field contains values that are not valid ObjectIds',
                    'VALUE_ERROR',
                    {
                      field: { name: fieldName, values: parent[fieldName] },
                    }
                  );

                // get the documents from their collection
                return await Promise.all(parent[fieldName].map(async (_id) => await Model.findById(_id)));
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
            [fieldName]: async (parent) => {
              // get the model from the type
              // * the provided type MUST be the name of a model (sans square brackets)
              const modelName = def.type[0].replace('[', '').replace(']', '');
              const Model = mongoose.model(modelName);

              // if the model does not exist, return a schema error
              if (!Model)
                throw new ApolloError(
                  'custom GraphSchemaType string must match the name of a collection model',
                  'SCHEMA_ERROR',
                  { invalidName: def.type[0] }
                );

              // ensure every the field value is an ObjectId
              const valueIsObjectId = isObjectId(parent[fieldName]);
              if (!valueIsObjectId)
                throw new ApolloError('the referenced field does not contain a valid ObjectId', 'VALUE_ERROR', {
                  field: { name: fieldName, value: parent[fieldName] },
                });

              // get the document from its collection
              return await Model.findById(parent[fieldName]);
            },
          };
        })
      ),
    } as c;

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
    ) as c;

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

export { genResolvers };
