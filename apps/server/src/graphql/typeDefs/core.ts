import { gql } from '../helpers/gql';

const core = gql`
  scalar Date
  scalar ObjectID
  scalar JSON
  scalar Void
  scalar Float

  type Paged<T> {
    docs: [T]!
    totalDocs: Int
    limit: Int
    page: Int
    totalPages: Int
    pagingCounter: Int
    hasPrevPage: Boolean
    hasNextPage: Boolean
    prevPage: Int
    nextPage: Int
  }

  type TenantDetails {
    name: String!
    displayName: String
  }

  type Query {
    """
    Get some details about the tenant.
    """
    tenant: TenantDetails
  }

`;

export { core };