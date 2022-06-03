import { gql } from '../helpers/gql';

const billing = gql`
  type Query {
    billing: Billing!
  }

  type Billing {
    """
    Gets the usage to be used for billing
    """
    usage: Usage!
  }

  type Usage {
    api(year: Int!, month: Int!): ApiUsage
    storage: UsageStorage!
  }

  type ApiUsage {
    billable: Float!
    total: Float!
  }

  type UsageStorage {
    database: Float!
    files: Float!
  }
`;

export { billing };
