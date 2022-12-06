/* eslint-disable @typescript-eslint/no-explicit-any */
import fileCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/File';
import { notEmpty } from '@jackbuehner/cristata-utils';
import { AuthenticationError } from 'apollo-server-core';
import AWS from 'aws-sdk';
import { merge } from 'merge-anything';
import helpers, { genCollection } from '../graphql/helpers';
import { setRawConfigurationCollection } from '../graphql/resolvers/configuration';
import { Context } from '../graphql/server';
import { Collection, CollectionPermissions } from '../types/config';
import { collectionsAsCollectionInputs } from '../utils/constructCollections';
import { CollectionSchemaFields } from './helpers/constructBasicSchemaFields';

const files = (tenant: string): Collection => {
  const { gql, requireAuthentication } = helpers;

  const collection = genCollection(
    {
      ...fileCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [] },
        create: { teams: ['admin'], users: [] },
        modify: { teams: ['admin'], users: [] },
        hide: { teams: ['admin'], users: [] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        archive: { teams: [], users: [] },
        delete: { teams: ['admin'], users: [] },
        publish: { teams: ['admin'], users: [] },
        bypassDocPermissions: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

  createBucket(tenant);

  collection.typeDefs += gql`
    extend type File {
      href: String
    }

    type FileCollectionActionAccess {
      get: FileCollectionActionAccessObject
      create: FileCollectionActionAccessObject
      modify: FileCollectionActionAccessObject
      hide: FileCollectionActionAccessObject
      lock: FileCollectionActionAccessObject
      watch: FileCollectionActionAccessObject
      delete: FileCollectionActionAccessObject
      archive: FileCollectionActionAccessObject
      publish: FileCollectionActionAccessObject
      bypassDocPermissions: FileCollectionActionAccessObject
    }

    type FileCollectionActionAccessObject {
      teams: [String!]
      users: [String!]
    }

    input FileCollectionActionAccessInput {
      get: FileCollectionActionAccessObjectInput
      create: FileCollectionActionAccessObjectInput
      modify: FileCollectionActionAccessObjectInput
      hide: FileCollectionActionAccessObjectInput
      lock: FileCollectionActionAccessObjectInput
      watch: FileCollectionActionAccessObjectInput
      delete: FileCollectionActionAccessObjectInput
      archive: FileCollectionActionAccessObjectInput
      publish: FileCollectionActionAccessObjectInput
      bypassDocPermissions: FileCollectionActionAccessObjectInput
    }

    input FileCollectionActionAccessObjectInput {
      teams: [String!]
      users: [String!]
    }

    type Mutation {
      """
      Sets the action access config for the File collection.
      """
      fileCollectionSetActionAccess(actionAccess: FileCollectionActionAccessInput!): FileCollectionActionAccess
    }
  `;

  collection.resolvers = merge(collection.resolvers, {
    Mutation: {
      fileCollectionSetActionAccess: async (
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
          (collection) => collection.name === 'File'
        );
        if (!currentCollectionConfig) throw new Error('could not find collection');

        // create the raw input used to generate the collection
        const raw = collectionsAsCollectionInputs(currentCollectionConfig);
        const rawCopy = JSON.parse(JSON.stringify(raw)) as typeof raw;

        // merge the new action access config with the existing one (overwrite arrays)
        rawCopy.actionAccess = merge(rawCopy.actionAccess, actionAccess);

        // attempt to save the change using the same logic as the normal collection configurations
        // (roll back changes if collection is invalid)
        const result = await setRawConfigurationCollection({ name: 'File', raw: rawCopy }, context);

        // return resultant actionAccess instead of the entire collection so the resolver type is correct
        return result.actionAccess;
      },
    },
  });

  return collection;
};

const credentials = {
  accessKeyId: process.env.AWS_SECRET_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
};

/**
 * Creates the AWS s3 bucket for the files collection.
 */
function createBucket(tenant: string) {
  AWS.config.update({ region: 'us-east-1' });
  const s3 = new AWS.S3(credentials);
  const bucketName = `app.cristata.${tenant}.files`;

  // obtain a list of bucket names for this aws account
  s3.listBuckets((err, { Buckets }) => {
    if (err) {
      console.error('Error in list buckets:', err);
    }

    const buckets = Buckets?.map((bucket) => bucket.Name).filter(notEmpty) || [];

    // return early if the bucket already exists
    if (buckets.includes(bucketName)) return;

    // create the bucket
    s3.createBucket({ Bucket: bucketName }, (err) => {
      if (err && err.statusCode !== 409) {
        // 409: bucket already exists
        console.error(err);
      }
    });

    // set CORS so we can upload using signed URLs
    s3.putBucketCors(
      {
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'HEAD', 'POST', 'PUT'],
              AllowedOrigins: ['*'],
              ExposeHeaders: [],
            },
          ],
        },
      },
      (err) => {
        if (err) console.error(err);
      }
    );
  });
}

interface IFile extends CollectionSchemaFields {
  name: string;
  file_type: string;
  size_byes: number;
  uuid: string;
  note?: string;
  tags?: string[];
  require_auth?: boolean;
}

export { files };
export type { IFile };
