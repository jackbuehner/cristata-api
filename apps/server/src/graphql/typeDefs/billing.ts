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
    stripe_customer_id: String
    stripe_subscription_id: String
    subscription_last_payment: String
    subscription_active: Boolean!
  }

  type Usage {
    api(year: Int, month: Int): ApiUsage
    storage: UsageStorage!
  }

  type ApiUsage {
    billable: Float!
    total: Float!
    since: Date!
  }

  type UsageStorage {
    database: Float!
    files: Float!
  }
`;

export { billing };
