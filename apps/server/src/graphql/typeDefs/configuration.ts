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

  type Mutation {
    """
    Set the groups of items to use for the sub navigation panel in the app.
    System groups that are provided in the query are removed upon receipt.
    """
    setConfigurationNavigationSub(key: String!, input: [ConfigurationNavigationSubGroupInput]!): [ConfigurationNavigationSubGroup]!
  }

  type ConfigurationNavigationMainItem {
    label: String!
    icon: String!
    to: String!
    subNav: String
  }

  type ConfigurationNavigationSubGroup {
    uuid: String!
    label: String!
    items: [ConfigurationNavigationSubGroupItems]!
  }

  type ConfigurationNavigationSubGroupItems {
    uuid: String!
    label: String!
    icon: String!
    to: String!
    hiddenFilter: ConfigurationNavigationSubGroupItemsHiddenFilter
  }

  type ConfigurationNavigationSubGroupItemsHiddenFilter {
    notInTeam: [String!]
  }

  input ConfigurationNavigationSubGroupInput {
    uuid: String!
    label: String!
    items: [ConfigurationNavigationSubGroupItemsInput]!
  }

  input ConfigurationNavigationSubGroupItemsInput {
    uuid: String!
    label: String!
    icon: String!
    to: String!
    isHidden: ConfigurationNavigationSubGroupItemsHiddenFilterInput
  }

  input ConfigurationNavigationSubGroupItemsHiddenFilterInput {
    notInTeam: [String!]
  }
`;

const collection = gql`
  extend type Configuration {
    collection(name: String!): ConfigurationCollection
    collections(): [ConfigurationCollection]
  }

  type ConfigurationCollection {
    name: String!
    pluralName: String!
    canPublish: Boolean
    withPermissions: Boolean
    """
    Use SchemaDef type from genSchema.ts
    """
    schemaDef: JSON!
    generationOptions: ConfigurationCollectionGenerationOptions
    by: ConfigurationCollectionBy!
    raw: JSON!
    """
    Whether the current user has 'create' and 'get' permisson on this collection
    """
    canCreateAndGet: Boolean
    """
    Whether the body field in the schema definition is a rich text (tiptap) field.
    """
    hasRichTextBody: Boolean!
  }

  type Mutation {
    setRawConfigurationCollection(name: String!, raw: JSON): JSON
    deleteCollection(name: String!): Void
  }

  type ConfigurationCollectionGenerationOptions {
    mandatoryWatchers: [String]
    previewUrl: String
    dynamicPreviewHref: String
    nameField: String
    disableCreateMutation: Boolean
    disableHideMutation: Boolean
    disableArchiveMutation: Boolean
    disablePublishMutation: Boolean
    independentPublishedDocCopy: Boolean
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
    _id: ObjectID!
    name: String!
    expires: String!
    user_id: String
    scope: ConfigurationSecurityTokenScope!
  }

  type ConfigurationSecurityTokenScope {
    admin: Boolean
  }

  input ConfigurationSecurityTokenScopeInput {
    admin: Boolean
  }

  type Mutation {
    setSecret(key: String!, value: String!): String!
    """
    Is no _id parameter is specified, a new token will be created from the parameters.
    Specify the token _id to update an existing token.

    Upon creation of a new token, the token will be returned.
    With existing token updates, nothing will be returned.
    """
    setToken(
      _id: ObjectID
      name: String!
      expires: String!
      user_id: String!
      scope: ConfigurationSecurityTokenScopeInput!
    ): String
  }
`;

const apps = gql`
  extend type Configuration {
    apps: ConfigurationApps!
  }

  type ConfigurationApps {
    void: Void
  }
`;

const profilesApp = gql`
  extend type ConfigurationApps {
    profiles: ConfigurationProfilesApp!
  }

  type ConfigurationProfilesApp {
    fieldDescriptions: ConfigurationProfilesAppFieldDescriptions!
    defaultFieldDescriptions: ConfigurationProfilesAppFieldDescriptions!
  }

  type ConfigurationProfilesAppFieldDescriptions {
    name: String!
    email: String!
    phone: String!
    twitter: String!
    biography: String!
    title: String!
  }

  input ConfigurationProfilesAppFieldDescriptionsInput {
    name: String
    email: String
    phone: String
    twitter: String
    biography: String
    title: String
  }

  type Mutation {
    setProfilesAppFieldDescriptions(input: ConfigurationProfilesAppFieldDescriptionsInput!): Void
  }
`;

const photosApp = gql`
  extend type ConfigurationApps {
    photos: ConfigurationPhotosApp!
  }

  type ConfigurationPhotosApp {
    fieldDescriptions: ConfigurationPhotosAppFieldDescriptions!
    defaultFieldDescriptions: ConfigurationPhotosAppFieldDescriptions!
  }

  type ConfigurationPhotosAppFieldDescriptions {
    name: String!
    source: String!
    tags: String!
    requireAuth: String!
    note: String!
  }

  input ConfigurationPhotosAppFieldDescriptionsInput {
    name: String!
    source: String!
    tags: String!
    requireAuth: String!
    note: String!
  }

  type Mutation {
    setPhotosAppFieldDescriptions(input: ConfigurationPhotosAppFieldDescriptionsInput!): Void
  }
`;

const configuration = base + dashboard + navigation + collection + security + apps + profilesApp + photosApp;

export { configuration };
