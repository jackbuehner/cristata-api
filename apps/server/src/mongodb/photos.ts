/* eslint-disable @typescript-eslint/no-explicit-any */
import photoCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Photo';
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

const photos = (tenant: string): Collection => {
  const { gql, requireAuthentication } = helpers;

  const collection = genCollection(
    {
      ...photoCollection,
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
    extend type Photo {
      href: String
      photo_url: String
    }

    type PhotoCollectionActionAccess {
      get: PhotoCollectionActionAccessObject
      create: PhotoCollectionActionAccessObject
      modify: PhotoCollectionActionAccessObject
      hide: PhotoCollectionActionAccessObject
      lock: PhotoCollectionActionAccessObject
      watch: PhotoCollectionActionAccessObject
      delete: PhotoCollectionActionAccessObject
      archive: PhotoCollectionActionAccessObject
      publish: PhotoCollectionActionAccessObject
      bypassDocPermissions: PhotoCollectionActionAccessObject
    }

    type PhotoCollectionActionAccessObject {
      teams: [String!]
      users: [String!]
    }

    input PhotoCollectionActionAccessInput {
      get: PhotoCollectionActionAccessObjectInput
      create: PhotoCollectionActionAccessObjectInput
      modify: PhotoCollectionActionAccessObjectInput
      hide: PhotoCollectionActionAccessObjectInput
      lock: PhotoCollectionActionAccessObjectInput
      watch: PhotoCollectionActionAccessObjectInput
      delete: PhotoCollectionActionAccessObjectInput
      archive: PhotoCollectionActionAccessObjectInput
      publish: PhotoCollectionActionAccessObjectInput
      bypassDocPermissions: PhotoCollectionActionAccessObjectInput
    }

    input PhotoCollectionActionAccessObjectInput {
      teams: [String!]
      users: [String!]
    }

    type Mutation {
      """
      Sets the action access config for the Photo collection.
      """
      photoCollectionSetActionAccess(
        actionAccess: PhotoCollectionActionAccessInput!
      ): PhotoCollectionActionAccess
    }
  `;

  collection.resolvers = merge(collection.resolvers, {
    Mutation: {
      photoCollectionSetActionAccess: async (
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
          (collection) => collection.name === 'Photo'
        );
        if (!currentCollectionConfig) throw new Error('could not find collection');

        // create the raw input used to generate the collection
        const raw = collectionsAsCollectionInputs(currentCollectionConfig);
        const rawCopy = JSON.parse(JSON.stringify(raw)) as typeof raw;

        // merge the new action access config with the existing one (overwrite arrays)
        rawCopy.actionAccess = merge(rawCopy.actionAccess, actionAccess);

        // attempt to save the change using the same logic as the normal collection configurations
        // (roll back changes if collection is invalid)
        const result = await setRawConfigurationCollection({ name: 'Photo', raw: rawCopy }, context);

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
 * Creates the AWS s3 bucket for the photos collection.
 */
function createBucket(tenant: string) {
  AWS.config.update({ region: 'us-east-1' });
  const s3 = new AWS.S3(credentials);
  const bucketName = tenant === 'paladin-news' ? 'paladin-photo-library' : `app.cristata.${tenant}.photos`;

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

interface IPhoto extends CollectionSchemaFields {
  name: string;
  file_type: string;
  size: number;
  uuid: string;
  note?: string;
  tags?: string[];
  require_auth?: boolean;
  dimensions?: {
    x?: number;
    y?: number;
  };
  people: {
    photo_created_by?: string;
  } & CollectionSchemaFields['people'];
  json?: string;
  legacy_caption?: string;
  legacy_thumbnail_id?: string;
  /**
   * In tenant `paladin-news`, photo locations were originally stored as a url instead of as a uuid. Prefer to use this url.
   */
  photo_url?: string;
}

export { photos };
export type { IPhoto };
