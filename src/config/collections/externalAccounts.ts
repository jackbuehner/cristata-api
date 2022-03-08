import type { Context } from '../../apollo';
import type { Collection } from '../database';
import mongoose from 'mongoose';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { Helpers } from '../../api/v3/helpers';
import { UsersType, TeamsType } from '../../types/config';

const externalAccounts = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const { createDoc, deleteDoc, findDoc, findDocs, getCollectionActionAccess, gql, hideDoc, modifyDoc } =
    helpers;

  return {
    name: 'ExternalAccount',
    canPublish: false,
    withPermissions: true,
    typeDefs: gql`
      type ExternalAccount inherits Collection, WithPermissions {
        service_url: String!
        username: String!
        password: String!
        otp_hash: String
      }
  
      input ExternalAccountCreateInput {
        service_url: String!
        username: String!
        password: String!
        otp_hash: String
      }
  
      input ExternalAccountModifyInput {
        service_url: String
        username: String
        password: String
        otp_hash: String
      }
  
      type Query {
        """
        Get an external account by _id.
        """
        externalAccount(_id: ObjectID!): ExternalAccount
        """
        Get a set of external accounts. If _ids is omitted, the API will return all external accounts.
        """
        externalAccounts(_ids: [ObjectID], filter: JSON, sort: JSON, page: Int, offset: Int, limit: Int!): Paged<ExternalAccount>
        """
        Get the permissions of the currently authenticated user for this
        collection. If _id is specified, get the permissions for the specific
        document.
        """
        externalAccountActionAccess(_id: ObjectID): CollectionActionAccess
      }
  
      type Mutation {
        """
        Create a new external account record.
        """
        externalAccountCreate(input: ExternalAccountCreateInput): ShortURL
        """
        Modify an existing external account record.
        """
        externalAccountModify(_id: ObjectID!, input: ShortURLModifyInput!): ShortURL
        """
        Toggle whether the hidden property is set to true for an existing
        external account.
        This mutation sets hidden: true by default.
        Hidden external account records should not be presented to clients; this
        should be used as a deletion that retains the data in case it is needed
        later.
        """
        externalAccountHide(_id: ObjectID!, hide: Boolean): ShortURL
        """
        Deletes a external account record.
        """
        externalAccountDelete(_id: ObjectID!): Void
      }
  
    `,
    resolvers: {
      Query: {
        externalAccount: (_, args, context: Context) =>
          findDoc({ model: 'ExternalAccount', _id: args._id, context }),
        externalAccounts: (_, args, context: Context) => findDocs({ model: 'ExternalAccount', args, context }),
        externalAccountActionAccess: (_, __, context: Context) =>
          getCollectionActionAccess({ model: 'ExternalAccount', context }),
      },

      Mutation: {
        shorturlCreate: (_, args, context: Context) => createDoc({ model: 'ExternalAccount', args, context }),
        shorturlModify: (_, { _id, input }, context: Context) =>
          modifyDoc({ model: 'ExternalAccount', data: { ...input, _id }, context }),
        shorturlHide: async (_, args, context: Context) => hideDoc({ model: 'ExternalAccount', args, context }),
        shorturlDelete: async (_, args, context: Context) =>
          deleteDoc({ model: 'ExternalAccount', args, context }),
      },
    },
    schemaFields: {
      service_url: { type: String, required: true },
      username: { type: String, required: true },
      password: { type: String, required: true },
    },
    actionAccess: () => ({
      get: { teams: [Teams.ADMIN], users: [] },
      create: { teams: [Teams.ADMIN], users: [] },
      modify: { teams: [Teams.ADMIN], users: [] },
      hide: { teams: [Teams.ADMIN], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    }),
  };
};

interface IExternalAccount extends CollectionSchemaFields {
  service_url: string;
  username: string;
  password: string;
  otp_hash?: string;
}

interface IExternalAccountDoc extends IExternalAccount, mongoose.Document {}

export type { IExternalAccount, IExternalAccountDoc };
export { externalAccounts };
