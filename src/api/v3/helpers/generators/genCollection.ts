import { Collection, CollectionPermissions } from '../../../../config/database';
import { GenSchemaInput } from './genSchema';
import helpers from '../';

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
    actionAccess: input.actionAccess,
  };
}

interface GenCollectionInput extends GenSchemaInput {
  actionAccess: CollectionPermissions;
}

export type { GenCollectionInput };
export { genCollection };
