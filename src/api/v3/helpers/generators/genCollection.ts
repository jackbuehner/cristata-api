import helpers from '../';
import { Collection, CollectionPermissions } from '../../../../types/config';
import { GenSchemaInput } from './genSchema';

function genCollection(input: GenCollectionInput): Collection {
  const { typeDefs, schemaFields } = helpers.generators.genSchema(input);
  const resolvers = helpers.generators.genResolvers({ helpers, ...input });

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
  };
}

interface GenCollectionInput extends GenSchemaInput {
  actionAccess: CollectionPermissions;
}

export type { GenCollectionInput };
export { genCollection };
