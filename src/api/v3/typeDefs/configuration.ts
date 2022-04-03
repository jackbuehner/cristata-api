import { gql } from '../helpers/gql';

const configuration = gql`
  type Configuration {
    navigation: ConfigurationNavigation!
  }

  type ConfigurationNavigation {
    """
    Get the items to use for the main navigation panel in the app.
    """
    main(): ConfigurationNavigationMainItem[]!
    """
    Get the groups of items to use for the sub navigation panel in the app.
    """
    sub(key: String!): ConfigurationNavigationSubGroup[]!
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
`;

export { configuration };
