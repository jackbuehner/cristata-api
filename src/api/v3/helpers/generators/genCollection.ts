import helpers from '../';
import { Collection, CollectionPermissions } from '../../../../types/config';
import { GenSchemaInput } from './genSchema';

function genCollection(input: GenCollectionInput, tenant: string): Collection {
  const { typeDefs, schemaFields, textIndexFieldNames } = helpers.generators.genSchema(input);
  const resolvers = helpers.generators.genResolvers({ helpers, ...input }, tenant);

  return {
    name: input.name,
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
  };
}

interface GenCollectionInput extends GenSchemaInput {
  actionAccess: CollectionPermissions;
}

export type { GenCollectionInput };
export { genCollection };
