import { gql } from '../helpers/gql';

const billing = gql`
  type Query {
    billing: Billing!
  }

  type Mutation {
    billing: MutationBilling!
  }

  type MutationBilling {
    features: MutationBillingFeatures!
  }

  type MutationBillingFeatures {
    allowDiskUse(allowDiskUse: Boolean!): Boolean!
    useCustomIntegrations(useCustomIntegrations: Boolean!): Boolean!
  }

  type Billing {
    """
    Gets the usage to be used for billing
    """
    usage: Usage!
    features: BillingFeatures!
    stripe_customer_id: String
    stripe_subscription_id: String
    subscription_last_payment: String
    subscription_active: Boolean!
  }

  type Usage {
    api(year: Int, month: Int): ApiUsage
    storage: UsageStorage!
  }

  type BillingFeatures {
    allowDiskUse: Boolean!
    useCustomIntegrations: Boolean!
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
