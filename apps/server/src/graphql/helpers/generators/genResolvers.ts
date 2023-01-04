import {
  calcAccessor,
  GenSchemaInput,
  isSchemaRef,
  SchemaDef,
  SchemaRef,
} from '@jackbuehner/cristata-generator-schema';
import {
  capitalize,
  dateAtTimeZero,
  flattenObject,
  hasKey,
  notEmpty,
  uncapitalize,
} from '@jackbuehner/cristata-utils';
import { UserInputError } from 'apollo-server-errors';
import { findAndReplace } from 'find-and-replace-anything';
import getFieldNames from 'graphql-list-fields';
import { merge } from 'merge-anything';
import mongoose, { FilterQuery } from 'mongoose';
import { get as getProperty } from 'object-path';
import pluralize from 'pluralize';
import { CollectionDoc, Helpers } from '..';
import { TenantDB } from '../../../mongodb/TenantDB';
import { Context } from '../../server';
import { constructDocFromRef } from './constructDocFromRef';
import { createProjection } from './createProjection';
import { resolveReferencedDocuments } from './resolveReferencedDocuments';

type Info = Parameters<typeof getFieldNames>[0];

async function construct(
  doc: CollectionDoc | null | undefined,
  schemaRefs: [string, SchemaRef][],
  context: Context,
  info: Info,
  helpers: Helpers,
  collectionName: string
): Promise<CollectionDoc | null> {
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

    constructedDoc = merge(constructedDoc, {
      permissions: { users: await helpers.getUsers(constructedDoc.permissions.users || [], context, fields) },
    } as unknown as Partial<CollectionDoc>);
  }

  // if the file collection, inject the file url
  if (collectionName === 'File') {
    doc.href = `${context.serverOrigin}/filestore/${context.tenant}/${doc._id}`;
  }

  // if the photo collection, inject the photo url
  if (collectionName === 'Photo') {
    doc.href = `${context.serverOrigin}/photo/${context.tenant}/${doc._id}`;
    doc.photo_url = `${context.serverOrigin}/photo/${context.tenant}/${doc._id}`;
  }

  return constructedDoc;
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

      if (!doc) return null;

      const [resolvedDoc] = await resolveReferencedDocuments([doc], info, context, name);
      return await construct(resolvedDoc, schemaRefs, context, info, helpers, name);
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

      const resolvedDocs = await resolveReferencedDocuments(docs, info, context, name);

      return {
        ...paged,
        docs: await Promise.all(
          resolvedDocs.map((doc) => construct(doc, schemaRefs, context, info, helpers, name))
        ),
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
      const generationOptions = context.config.collections.find((col) => col.name === name)?.generationOptions;

      // rewrite the filter if we need to query the published copy
      let filter = publicRules.filter;
      if (generationOptions?.independentPublishedDocCopy) {
        const newFilter = {};
        Object.entries(filter).forEach(([key, value]) => {
          filter[`__publishedDoc.${key}`] = value;
        });
        filter = newFilter;
      }

      const doc = await helpers.findDoc({
        model: name,
        by: oneAccessorName,
        _id:
          oneAccessorType.replace('!', '') === 'Date' ? new Date(args[oneAccessorName]) : args[oneAccessorName],
        filter: filter,
        context,
        fullAccess: true,
        project: createProjection(info, config, {
          prefix: generationOptions?.independentPublishedDocCopy ? '__publishedDoc.' : undefined,
        }),
      });

      if (!doc) return null;

      if (generationOptions?.independentPublishedDocCopy) {
        if (!doc.__publishedDoc) return null;

        const [resolvedDoc] = await resolveReferencedDocuments([doc.__publishedDoc], info, context, name);
        return await construct(resolvedDoc, schemaRefs, context, info, helpers, name);
      }

      const [resolvedDoc] = await resolveReferencedDocuments([doc], info, context, name);
      return await construct(resolvedDoc, schemaRefs, context, info, helpers, name);
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
      const generationOptions = context.config.collections.find((col) => col.name === name)?.generationOptions;

      // rewrite the filter if we need to query the published copy
      let filter = { ...args.filter, ...publicRules.filter };
      if (generationOptions?.independentPublishedDocCopy) {
        const newFilter: FilterQuery<CollectionDoc> = {};
        Object.entries(filter).forEach(([key, value]) => {
          newFilter[`__publishedDoc.${key}`] = value;
        });
        filter = { ...newFilter, __publishedDoc: { $exists: true } };
      }

      const { docs, ...paged }: { docs: CollectionDoc[] } = await helpers.findDocs({
        model: name,
        args: { ...args, filter: filter },
        context,
        fullAccess: true,
        project: createProjection(info, config, {
          prefix: generationOptions?.independentPublishedDocCopy ? '__publishedDoc.' : undefined,
        }),
      });

      if (generationOptions?.independentPublishedDocCopy) {
        const publishedDocs = docs.map((doc) => doc.__publishedDoc).filter(notEmpty);
        const resolvedDocs = await resolveReferencedDocuments(publishedDocs, info, context, name);
        return {
          ...paged,
          docs: await Promise.all(
            resolvedDocs.map((doc) => construct(doc, schemaRefs, context, info, helpers, name))
          ),
        };
      }

      const resolvedDocs = await resolveReferencedDocuments(docs, info, context, name);
      return {
        ...paged,
        docs: await Promise.all(
          resolvedDocs.map((doc) => construct(doc, schemaRefs, context, info, helpers, name))
        ),
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
      const generationOptions = context.config.collections.find((col) => col.name === name)?.generationOptions;

      // create filter to find newest document with matching slug
      let filter =
        args.date && publicRules.slugDateField
          ? {
              [publicRules.slugDateField]: {
                $gte: dateAtTimeZero(args.date),
                $lt: new Date(dateAtTimeZero(args.date).getTime() + 24 * 60 * 60 * 1000),
              },
              ...publicRules.filter,
            }
          : publicRules.filter;

      // rewrite the filter if we need to query the published copy
      if (generationOptions?.independentPublishedDocCopy) {
        const newFilter = {};
        Object.entries(filter).forEach(([key, value]) => {
          filter[`__publishedDoc.${key}`] = value;
        });
        filter = newFilter;
      }

      // get the doc
      const doc = await helpers.findDoc({
        model: name,
        by: 'slug',
        _id: args.slug,
        filter,
        context,
        fullAccess: true,
        project: createProjection(info, config, {
          prefix: generationOptions?.independentPublishedDocCopy ? '__publishedDoc.' : undefined,
        }),
      });

      if (!doc) return null;

      if (generationOptions?.independentPublishedDocCopy) {
        if (!doc.__publishedDoc) return null;

        const [resolvedDoc] = await resolveReferencedDocuments([doc.__publishedDoc], info, context, name);
        return await construct(resolvedDoc, schemaRefs, context, info, helpers, name);
      }

      // return a fully constructed doc
      const [resolvedDoc] = await resolveReferencedDocuments([doc], info, context, name);
      return await construct(resolvedDoc, schemaRefs, context, info, helpers, name);
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

        const canAllowDiskUse = context.cristata.canTenantAllowDiskUse[context.tenant] || false;
        const aggregate = await Model?.aggregate(populatedPipline).allowDiskUse(canAllowDiskUse);

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
        const generationOptions = context.config.collections.find(
          (col) => col.name === name
        )?.generationOptions;

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
            if (generationOptions?.independentPublishedDocCopy && doc.__publishedDoc) {
              doc.__publishedDoc[mutation.action.inc[0]] += args[`inc${capitalize(mutation.action.inc[0])}`];
              return doc.save().then((doc) => doc?.__publishedDoc || null);
            }
            return doc.save();
          }

          return doc;
        }
      };
    });
  }

  return { Query, Mutation };
}

type ResolverType = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (parent: unknown, args: any, context: Context, info: Info) => Promise<unknown | unknown[]>
>;

interface GenResolversInput extends GenSchemaInput {
  helpers: Helpers;
}

export type { GenResolversInput };
export { genResolvers, construct };
