import { gql } from '../helpers/gql';

const s3 = gql`
  type S3SignedResponse {
    signedRequest: String!
    location: String!
  }

  type Query {
    """
    Get a signed s3 URL for uploading photos and documents to an existing s3 bucket.
    """
    s3Sign(fileName: String!, fileType: String!, s3Bucket: String!): S3SignedResponse
  }
`;

export { s3 };
