import helpers from '..';
import { Collection, CollectionPermissions } from '../../../../types/config';
import { GenSchemaInput } from './genSchema';

function genCollection(input: GenCollectionInput, tenant: string): Collection {
  if (input.singleDocument === true) {
    if (!input.options) input.options = {};
    input.options.disableHideMutation = true;
    input.options.disableLockMutation = true;
    input.options.disableWatchMutation = true;
    input.options.disableArchiveMutation = true;
    input.options.disableDeleteMutation = true;
    input.options.disablePublishMutation = true;
    input.options.disablePublicFindOneBySlugQuery = true;
    input.options.disablePublicFindOneQuery = true;
  }

  const { typeDefs, schemaFields, textIndexFieldNames } = helpers.generators.genSchema(input);
  const resolvers = helpers.generators.genResolvers({ helpers, ...input }, tenant);

  return {
    name: input.name,
    navLabel: input.navLabel,
    canPublish: input.canPublish,
    withPermissions: input.withPermissions,
    typeDefs,
    resolvers,
    schemaFields,
    schemaDef: input.schemaDef,
    generationOptions: input.options,
    actionAccess: input.actionAccess,
    by: input.by,
    raw: input,
    textIndexFieldNames,
    singleDocument: input.singleDocument || false,
  };
}

interface GenCollectionInput extends GenSchemaInput {
  actionAccess: CollectionPermissions;
  singleDocument?: boolean;
  navLabel?: string;
}

export type { GenCollectionInput };
export { genCollection };
