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

  type WorkflowGroup {
    _id: Int!,
    count: Int!,
    docs: [WorkflowGroupDoc]!
  }

  type WorkflowGroupDoc {
    _id: ObjectID!
    name: String
    stage: Float!
    in: String!
  }

  type Query {
    """
    Get some details about the tenant.
    """
    tenant: TenantDetails
    """
    Get the docs in the different workflow categories
    """
    workflow(collections: [String], exclude: [String]): [WorkflowGroup!]
  }
`;

export { core };
