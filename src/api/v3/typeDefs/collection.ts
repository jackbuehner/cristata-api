import { gql } from '../helpers/gql';

const collection = gql`
  type Collection {
    _id: ObjectID!
    timestamps: CollectionTimestamps
    people: CollectionPeople
    hidden: Boolean!
    locked: Boolean!
    history: [CollectionHistory]
  }

  type WithPermissions {
    permissions: CollectionPermissions!
  }

  type CollectionPermissions {
    teams: [String]!
    users: [User]!
  }

  input WithPermissionsInput {
    permissions: CollectionPermissionsInput
  }

  input CollectionPermissionsInput {
    teams: [ObjectID]
    users: [ObjectID]
  }

  type PublishableCollection inherits Collection {
    timestamps: PublishableCollectionTimestamps
    people: PublishableCollectionPeople
  }

  type CollectionTimestamps {
    created_at: Date!
    modified_at: Date!
  }

  type PublishableCollectionTimestamps inherits CollectionTimestamps {
    published_at: Date!
    updated_at: Date!
  }

  type CollectionPeople {
    created_by: User
    modified_by: [User]
    last_modified_by: User
    watching: [User]
  }

  type PublishableCollectionPeople inherits CollectionPeople {
    published_by: [User]
    last_published_by: User
  }

  type CollectionHistory {
    type: String!
    user: User
    at: Date!
  }

  type CollectionActionAccess {
    get: Boolean!
    create: Boolean!
    modify: Boolean!
    hide: Boolean!
    lock: Boolean!
    watch: Boolean!
    """
    Only for collections that allow publishing
    """
    publish: Boolean
    """
    Only for the users collection
    """
    deactivate: Boolean
    delete: Boolean!
  }

  type CollectionActivity {
    _id: ObjectID!,
    name: String,
    in: String!,
    user: User, # the user id in the database is sometimes missing or corrupted
    action: String!,
    at: Date!, #// TODO: this might not actually always be there
  }

  type Query {
    """
    Get the recent activity in the specified collections
    """
    collectionActivity(limit: Int!, collections: [String], exclude: [String], page: Int): Paged<CollectionActivity>
  }
`;

export { collection };
