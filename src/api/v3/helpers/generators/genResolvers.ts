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
  isTypeTuple,
  SchemaDef,
  SchemaDefType,
} from './genSchema';
import { calcAccessor } from './genTypeDefs';
import { getUsers } from '../getUsers';
import { merge } from 'merge-anything';
import { capitalize } from '../../../../utils/capitalize';
import { hasKey } from '../../../../utils/hasKey';
import { dateAtTimeZero } from '../../../../utils/dateAtTimeZero';
import { findAndReplace } from 'find-and-replace-anything';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function genResolvers({ name, helpers, ...input }: GenResolversInput) {
  const [oneAccessorName] = calcAccessor('one', input.by);
  const hasPublic = JSON.stringify(input.schemaDef).includes(`"public":true`);
  const hasSlug =
    hasKey('slug', input.schemaDef) &&
    ((input.schemaDef.slug as SchemaDef).type === String ||
      (input.schemaDef.slug as SchemaDef).type === mongoose.Schema.Types.String);

  const Query = {
    /**
     * Finds a single document by the accessor specified in the config.
     */
    [name.toLowerCase()]: async (parent, args, context: Context) => {
      return await helpers.findDoc({ model: name, by: oneAccessorName, _id: args[oneAccessorName], context });
    },
    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     */
    [`${name.toLowerCase()}s`]: async (parent, args, context: Context) => {
      return await helpers.findDocs({ model: name, args, context });
    },
    /**
     * Get the action access ofor the collection.
     */
    [`${name.toLowerCase()}ActionAccess`]: async (parent, args, context: Context) => {
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
    Query[`${name.toLowerCase()}Public`] = (async (parent, args, context: Context) => {
      return await helpers.findDoc({
        model: name,
        by: oneAccessorName,
        _id: args[oneAccessorName],
        filter: publicRules.filter,
        context,
        fullAccess: true,
      });
    }) as unknown as (doc: never) => Promise<never[]>;

    /**
     * Finds multiple documents by _id.
     *
     * TODO: search by a custom accessor (`manyAccessorName`)
     *
     * This query is for the Pruned document type, which disallows getting
     * fields unless they are marked `public: true`.
     */
    Query[`${name.toLowerCase()}sPublic`] = (async (parent, args, context: Context) => {
      return await helpers.findDocs({
        model: name,
        args: { ...args, filter: { ...args.filter, ...publicRules.filter } },
        context,
        fullAccess: true,
      });
    }) as unknown as (doc: never) => Promise<never[]>;

    if (hasSlug && publicRules.slugDateField) {
      /**
       * Finds a single document by slug and optional date.
       *
       * This query is for the Pruned document type, which disallows getting
       * fields unless they are marked `public: true`.
       */
      Query[`${name.toLowerCase()}BySlugPublic`] = (async (parent, args, context: Context) => {
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

        return await helpers.findDoc({
          model: name,
          by: 'slug',
          _id: args.slug,
          filter,
          context,
          fullAccess: true,
        });
      }) as unknown as (doc: never) => Promise<never[]>;
    }
  }

  if (input.customQueries) {
    input.customQueries.forEach((query) => {
      const customQueryName = name.toLowerCase() + capitalize(query.name);

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

  const Mutation = {
    [`${name.toLowerCase()}Create`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'CREATED',
        helpers.createDoc({ model: name, args, context, withPermissions: input.withPermissions })
      );
    },
    [`${name.toLowerCase()}Modify`]: async (parent, { _id, input }, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.modifyDoc({ model: name, data: { ...input, _id }, context })
      );
    },
    [`${name.toLowerCase()}Hide`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.hideDoc({ model: name, args, context })
      );
    },
    [`${name.toLowerCase()}Lock`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.lockDoc({ model: name, args, context })
      );
    },
    [`${name.toLowerCase()}Watch`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'MODIFIED',
        helpers.watchDoc({ model: name, args, context })
      );
    },
    [`${name.toLowerCase()}Delete`]: async (parent, args, context: Context) => {
      return await helpers.withPubSub(
        name.toUpperCase(),
        'DELETED',
        helpers.deleteDoc({ model: name, args, context })
      );
    },
    [`${name.toLowerCase()}Publish`]: input.canPublish
      ? async (parent, args, context: Context) => {
          return await helpers.withPubSub(
            name.toUpperCase(),
            'DELETED',
            helpers.publishDoc({ model: name, args, context })
          );
        }
      : undefined,
  } as c;

  const Subscription = {
    [`${name.toLowerCase()}Created`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_CREATED`]),
    },
    [`${name.toLowerCase()}Modified`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_MODIFIED`]),
    },
    [`${name.toLowerCase()}Deleted`]: {
      subscribe: () => pubsub.asyncIterator([`${name.toUpperCase()}_DELETED`]),
    },
  };

  const baselineResolvers = { Query, Mutation, Subscription };
  const customResolvers = genCustomResolvers({ name, helpers, ...input });

  return { ...baselineResolvers, ...customResolvers };
}

type c = Record<string, (doc: never) => Promise<never[]>>;
function genCustomResolvers(input: GenResolversInput): c {
  const gen = (parentName: string, schemaDef: SchemaDefType) => {
    // only store schema defs that have defined a custom graphql type, which
    // requires a custom resolver (e.g. '[Users]')
    const schemaDefsWithCustomGraphType = Object.entries(schemaDef).filter(
      ([, def]) => isSchemaDef(def) && isTypeTuple(def.type) && isCustomGraphSchemaType(def.type[0])
    ) as unknown as Array<[string, SchemaDefsWithCustomGraphType]>;

    // generate a custom resolver
    const customResolver = {
      [parentName]: merge(
        {},
        ...schemaDefsWithCustomGraphType.map(([name, def]) => {
          // if the type is an array of user documents, get the user object ids from
          // the parent document and retrieve the user documents
          if (def.type[0] === '[User]') {
            return {
              [name]: async (doc) => {
                return await getUsers(doc[name]);
              },
            };
          }

          // if the type is a user document, get the user object id from
          // the parent document and retrieve the user document
          if (def.type[0] === 'User') {
            return {
              [name]: async (doc) => {
                return await getUsers(doc[name]);
              },
            };
          }

          // if the type is an array of team documents, get the team object ids from
          // the parent document and retrieve the team documents
          if (def.type[0] === '[Team]') {
            return {
              [name]: async (doc) => {
                return await Promise.all(
                  doc[name].map(async (_id) => await mongoose.model(name).findById(_id))
                );
              },
            };
          }

          // if the type is a team document, get the team object id from
          // the parent document and retrieve the team document
          if (def.type[0] === name) {
            return {
              [name]: async (doc) => {
                return await mongoose.model(name).findById(doc[name]);
              },
            };
          }
        })
      ),
    } as c;

    // identify the nested schemas
    const nestedSchemaDefs = Object.entries(schemaDef).filter(([, def]) => !isSchemaDef(def)) as Array<
      [string, SchemaDefType]
    >;

    // generate custom resolvers for the nested schemas
    const nestedCustomResolvers = merge(
      {},
      ...nestedSchemaDefs.map(([name, nestedSchemaDef]) => {
        let obj = {};

        // include baseline people resolvers if it is for people
        if (name === 'people') {
          if (input.canPublish)
            obj = { ...obj, [input.name + 'People']: { ...publishableCollectionPeopleResolvers } };
          else obj = { ...obj, [input.name + 'People']: { ...collectionPeopleResolvers } };
        }

        return merge(
          obj,
          // send nested schemea through this function to generate the resolvers
          gen(name.indexOf(input.name) === 0 ? '' : parentName + capitalize(name), nestedSchemaDef)
        );
      })
    ) as c;

    // return empty object for undefined resolvers
    if (customResolver[parentName] === undefined) {
      return {};
    }

    return { ...customResolver, ...nestedCustomResolvers };
  };

  return gen(input.name, input.schemaDef);
}

interface GenResolversInput extends GenSchemaInput {
  helpers: Helpers;
}

interface SchemaDefsWithCustomGraphType extends Omit<SchemaDef, 'type'> {
  type: string;
}

export { genResolvers };
