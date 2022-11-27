import { gql } from '../helpers/gql';

const base = gql`
  type Configuration {
    void: Void
  }

  type Query {
    configuration(): Configuration 
  }
`;

const dashboard = gql`
  extend type Configuration {
    dashboard: ConfigurationDashboard!
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
`;

const navigation = gql`
  extend type Configuration {
    navigation: ConfigurationNavigation!
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
`;

const collection = gql`
  extend type Configuration {
    collection(name: String!): ConfigurationCollection
    collections(): [ConfigurationCollection]
  }

  type ConfigurationCollection {
    name: String!
    canPublish: Boolean
    withPermissions: Boolean
    """
    Use SchemaDef type from genSchema.ts
    """
    schemaDef: JSON!
    generationOptions: ConfigurationCollectionGenerationOptions
    by: ConfigurationCollectionBy!
    raw: JSON!
  }

  type Mutation {
    setRawConfigurationCollection(name: String!, raw: JSON): JSON
    deleteCollection(name: String!): Void
  }

  type ConfigurationCollectionGenerationOptions {
    mandatoryWatchers: [String]
    previewUrl: String
    nameField: String
    disableCreateMutation: Boolean
    disableHideMutation: Boolean
    disableArchiveMutation: Boolean
    disablePublishMutation: Boolean
  }

  type ConfigurationCollectionBy {
    one: String!
    many: String!
  }
`;

const security = gql`
  extend type Configuration {
    security: ConfigurationSecurity!
  }

  type ConfigurationSecurity {
    introspection: Boolean!
    secrets: ConfigurationSecuritySecrets!
    tokens: [ConfigurationSecurityToken]!
  }

  type ConfigurationSecuritySecrets {
    fathom: ConfigurationSecuritySecretsFathom
  }

  type ConfigurationSecuritySecretsFathom {
    siteId: String!
    dashboardPassword: String!
  }

  type ConfigurationSecurityToken {
    name: String!
    token: String!
    expires: String!
    scope: ConfigurationSecurityTokenScope!
  }

  type ConfigurationSecurityTokenScope {
    admin: Boolean
  }

  type Mutation {
    setSecret(key: String!, value: String!): String!
  }
`;

const configuration = base + dashboard + navigation + collection + security;

export { configuration };
