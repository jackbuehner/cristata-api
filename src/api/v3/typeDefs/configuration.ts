import { gql } from '../helpers/gql';

const configuration = gql`
  type Configuration {
    dashboard: ConfigurationDashboard!
    navigation: ConfigurationNavigation!
  }

  type ConfigurationDashboard {
    collectionRows(): [ConfigurationDashboardCollectionRow]!
  }

  type ConfigurationDashboardCollectionRow {
    header: ConfigurationDashboardCollectionRowHeader!
    to: ConfigurationDashboardCollectionRowTo!
    query: String!
    arrPath: String!
    dataKeys: ConfigurationDashboardCollectionRowDataKeys!
  }

  type ConfigurationDashboardCollectionRowHeader {
    label: String!
    icon: String!
  }

  type ConfigurationDashboardCollectionRowTo {
    idPrefix: String!
    idSuffix: String!
  }

  type ConfigurationDashboardCollectionRowDataKeys {
    _id: String!
    name: String!
    description: String
    photo: String
    lastModifiedBy: String!
    lastModifiedAt: String!
  }

  type ConfigurationNavigation {
    """
    Get the items to use for the main navigation panel in the app.
    """
    main(): [ConfigurationNavigationMainItem]!
    """
    Get the groups of items to use for the sub navigation panel in the app.
    """
    sub(key: String!): [ConfigurationNavigationSubGroup]!
  }

  type ConfigurationNavigationMainItem {
    label: String!
    icon: String!
    to: String!
    subNav: String
  }

  type ConfigurationNavigationSubGroup {
    label: String!
    items: [ConfigurationNavigationSubGroupItems]!
  }

  type ConfigurationNavigationSubGroupItems {
    label: String!
    icon: String!
    to: String!
  }

  type Query {
    configuration(): Configuration 
  }
`;

export { configuration };
