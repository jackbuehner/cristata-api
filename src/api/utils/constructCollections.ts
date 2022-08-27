import helpers from '../graphql/helpers';
import { GenCollectionInput } from '../graphql/helpers/generators/genCollection';
import teams from '../mongodb/teams.collection.json';
import { users } from '../mongodb/users';
import { Collection } from '../types/config';
import { hasKey } from './hasKey';

function constructCollections(collections: (Collection | GenCollectionInput)[], tenant: string): Collection[] {
  if (tenant === 'admin') throw new Error('cannot create a database for tenant with name "admin"');
  if (tenant === 'local') throw new Error('cannot create a database for tenant with name "local"');
  if (tenant === 'users') throw new Error('cannot create a database for tenant with name "users"');

  return [
    users(tenant),
    helpers.generators.genCollection(teams as unknown as GenCollectionInput, tenant),
    ...collections
      .filter((col): col is GenCollectionInput => !!col && !isCollection(col))
      .filter((col) => col.name !== 'User')
      .filter((col) => col.name !== 'Team')
      .map((col) => helpers.generators.genCollection(col, tenant)),
    ...collections
      .filter((col): col is Collection => isCollection(col))
      .filter((col) => col.name !== 'User')
      .filter((col) => col.name !== 'Team'),
  ];
}

function isCollection(toCheck: Collection | GenCollectionInput): toCheck is Collection {
  return (
    hasKey('typeDefs', toCheck) &&
    hasKey('resolvers', toCheck) &&
    hasKey('schemaFields', toCheck) &&
    hasKey('textIndexFieldNames', toCheck)
  );
}

/**
 * Converts full collections into collection generator inputs. This is helpful
 * for if you want to ensure collections are regenerated by `constructCollections`.
 *
 * This is needed if a deep copy of a collection is made because a deep copy will
 * not retain the function references inside the `collection.resolvers` object.
 */
function convertCollectionToCollectionInput(col: Collection | GenCollectionInput): void {
  if (isCollection(col)) {
    //@ts-expect-error deleting thse coverts the type from Collection to GenCollectionInput
    delete col.resolvers;
    //@ts-expect-error deleting thse coverts the type from Collection to GenCollectionInput
    delete col.typeDefs;
    //@ts-expect-error deleting thse coverts the type from Collection to GenCollectionInput
    delete col.schemaFields;
    //@ts-expect-error deleting thse coverts the type from Collection to GenCollectionInput
    delete col.textIndexFieldNames;
  }
}

export { constructCollections, convertCollectionToCollectionInput };
