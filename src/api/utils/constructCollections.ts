import helpers from '../graphql/helpers';
import { GenCollectionInput } from '../graphql/helpers/generators/genCollection';
import teams from '../mongodb/teams.collection.json';
import { users } from '../mongodb/users';
import { Collection, Configuration } from '../types/config';
import { hasKey } from './hasKey';

function constructCollections(
  collections: Array<Collection | GenCollectionInput>,
  tenant: string
): Array<Collection> {
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
  return hasKey('typeDefs', toCheck) && hasKey('resolvers', toCheck);
}

export { constructCollections };
