/* eslint-disable @typescript-eslint/no-explicit-any */
import externalAccountCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/ExternalAccount';
import { AuthenticationError } from 'apollo-server-core';
import { merge } from 'merge-anything';
import helpers, { genCollection } from '../graphql/helpers';
import { setRawConfigurationCollection } from '../graphql/resolvers/configuration';
import { Context } from '../graphql/server';
import { Collection, CollectionPermissions } from '../types/config';
import { collectionsAsCollectionInputs } from '../utils/constructCollections';

/**
 * *ExternalAccount* collection
 */
const accounts = (tenant: string): Collection => {
  const { gql, requireAuthentication } = helpers;

  const collection = genCollection(
    {
      ...externalAccountCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [] },
        create: { teams: ['admin'], users: [] },
        modify: { teams: ['admin'], users: [] },
        hide: { teams: [], users: [] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        archive: { teams: [], users: [] },
        delete: { teams: ['admin'], users: [] },
        publish: { teams: [], users: [] },
        bypassDocPermissions: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

  collection.typeDefs += gql`
    type ExternalAccountCollectionActionAccess {
      get: ExternalAccountCollectionActionAccessObject
      create: ExternalAccountCollectionActionAccessObject
      modify: ExternalAccountCollectionActionAccessObject
      delete: ExternalAccountCollectionActionAccessObject
    }

    type ExternalAccountCollectionActionAccessObject {
      teams: [String!]
      users: [String!]
    }

    input ExternalAccountCollectionActionAccessInput {
      get: ExternalAccountCollectionActionAccessObjectInput
      create: ExternalAccountCollectionActionAccessObjectInput
      modify: ExternalAccountCollectionActionAccessObjectInput
      delete: ExternalAccountCollectionActionAccessObjectInput
    }

    input ExternalAccountCollectionActionAccessObjectInput {
      teams: [String!]
      users: [String!]
    }

    type Mutation {
      """
      Sets the action access config for the ExternalAccount collection.
      """
      externalAccountCollectionSetActionAccess(
        actionAccess: ExternalAccountCollectionActionAccessInput!
      ): ExternalAccountCollectionActionAccess
    }
  `;

  collection.resolvers = merge(collection.resolvers, {
    Mutation: {
      externalAccountCollectionSetActionAccess: async (
        _: never,
        { actionAccess }: { actionAccess: Partial<CollectionPermissions> },
        context: Context
      ) => {
        // only allow administrators to make changes to action access for the collection
        requireAuthentication(context);
        const isAdmin = context.profile?.teams.includes('000000000000000000000001');
        if (!isAdmin) throw new AuthenticationError('you must be an administrator');

        // get the current config value
        const currentCollectionConfig = context.config.collections.find(
          (collection) => collection.name === 'ExternalAccount'
        );
        if (!currentCollectionConfig) throw new Error('could not find collection');

        // create the raw input used to generate the collection
        const raw = collectionsAsCollectionInputs(currentCollectionConfig);
        const rawCopy = JSON.parse(JSON.stringify(raw)) as typeof raw;

        // merge the new action access config with the existing one (overwrite arrays)
        rawCopy.actionAccess = merge(rawCopy.actionAccess, actionAccess);

        // attempt to save the change using the same logic as the normal collection configurations
        // (roll back changes if collection is invalid)
        const result = await setRawConfigurationCollection({ name: 'ExternalAccount', raw: rawCopy }, context);

        // return resultant actionAccess instead of the entire collection so the resolver type is correct
        return result.actionAccess;
      },
    },
  });

  return collection;
};

export { accounts };
