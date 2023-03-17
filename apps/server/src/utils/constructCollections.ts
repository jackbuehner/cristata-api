import { hasKey } from '@jackbuehner/cristata-utils';
import { merge } from 'merge-anything';
import helpers from '../graphql/helpers';
import { GenCollectionInput } from '../graphql/helpers/generators/genCollection';
import { activities } from '../mongodb/activities';
import { files } from '../mongodb/files';
import { photos } from '../mongodb/photos';
import teams from '../mongodb/teams.collection.json';
import { users } from '../mongodb/users';
import { Collection } from '../types/config';

function constructCollections(collections: (Collection | GenCollectionInput)[], tenant: string): Collection[] {
  if (tenant === 'admin') throw new Error('cannot create a database for tenant with name "admin"');
  if (tenant === 'local') throw new Error('cannot create a database for tenant with name "local"');
  if (tenant === 'users') throw new Error('cannot create a database for tenant with name "users"');

  // merge select options from the provided collections with system collections
  const filesConfig = collections.find((col) => col.name === 'File');
  const filesCollection = (() => {
    if (filesConfig?.actionAccess) {
      return merge(files(tenant), {
        actionAccess: filesConfig.actionAccess,
        raw: { actionAccess: filesConfig.actionAccess },
      });
    }
    return files(tenant);
  })();

  const photosConfig = collections.find((col) => col.name === 'Photo');
  const photosCollection = (() => {
    if (photosConfig?.actionAccess) {
      return merge(photos(tenant), {
        actionAccess: photosConfig.actionAccess,
        raw: { actionAccess: photosConfig.actionAccess },
      });
    }
    return photos(tenant);
  })();

  const usersConfig = collections.find((col) => col.name === 'User');
  const usersCollection = (() => {
    if (usersConfig?.actionAccess) {
      return merge(users(tenant), {
        actionAccess: usersConfig.actionAccess,
        raw: { actionAccess: usersConfig.actionAccess },
      });
    }
    return users(tenant);
  })();

  return [
    usersCollection,
    filesCollection,
    photosCollection,
    activities(tenant),
    helpers.generators.genCollection(teams as unknown as GenCollectionInput, tenant),
    ...collections
      .filter((col): col is GenCollectionInput => !!col && !isCollection(col))
      .filter((col) => col.name !== 'User')
      .filter((col) => col.name !== 'Team')
      .filter((col) => col.name !== 'File')
      .filter((col) => col.name !== 'Photo')
      .filter((col) => col.name !== 'Activity')
      .map((col) => helpers.generators.genCollection(col, tenant)),
    ...collections
      .filter((col): col is Collection => isCollection(col))
      .filter((col) => col.name !== 'User')
      .filter((col) => col.name !== 'Team')
      .filter((col) => col.name !== 'File')
      .filter((col) => col.name !== 'Photo')
      .filter((col) => col.name !== 'Activity'),
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
function collectionsAsCollectionInputs(value: Collection) {
  return value.raw;
}

export { constructCollections, collectionsAsCollectionInputs };
