import { Helpers } from '..';
import { Collection, CollectionPermissions } from '../../../../config/database';
import { GenSchemaInput } from './genSchema';

function genCollection(input: GenCollectionInput): Collection {
  const { typeDefs, schemaFields } = input.helpers.generators.genSchema(input);
  const resolvers = input.helpers.generators.genResolvers(input);

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
  helpers: Helpers;
  actionAccess: CollectionPermissions;
}

export { genCollection };
