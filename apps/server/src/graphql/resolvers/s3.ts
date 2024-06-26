import { ApolloError } from 'apollo-server-errors';
import aws from 'aws-sdk';
import { requireAuthentication } from '../helpers';
import { Context } from '../server';

const credentials = {
  accessKeyId: process.env.AWS_SECRET_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
};

const s3 = {
  Query: {
    s3Sign: async (
      _: never,
      { fileName, fileType, s3Bucket }: Record<string, unknown>,
      context: Context
    ): Promise<{ signedRequest: string; location: string }> => {
      requireAuthentication(context);
      aws.config.update({ region: 'us-east-1' });
      const s3 = new aws.S3({ credentials });

      const s3Params = {
        Bucket: s3Bucket,
        Key: fileName,
        Expires: 300, // 5 minutes for upload (some photos are big)
        ContentType: fileType,
        ACL: 'public-read',
      };

      // wrap the s3 callback in a promise so we can return values from the callback
      return await new Promise((resolve) => {
        // get a signed url for putting a file in an s3 bucket
        s3.getSignedUrl('putObject', s3Params, (err, signedRequest) => {
          if (err) {
            console.error(err);
            throw new ApolloError(err.message, 'AWS_S3_ERROR');
          }
          resolve({
            signedRequest,
            location: `https://s3.us-east-1.amazonaws.com/${s3Bucket}/${fileName}`,
          });
        });
      });
    },
  },
};

export { s3 };
