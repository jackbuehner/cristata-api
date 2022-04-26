/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import { getUsers } from '../helpers';

const collectionPeopleResolvers = {
  created_by: ({ created_by }, __, context: Context) => getUsers(created_by, context),
  modified_by: ({ modified_by }, __, context: Context) => getUsers(modified_by, context),
  last_modified_by: ({ last_modified_by }, __, context: Context) => getUsers(last_modified_by, context),
  watching: ({ watching }, __, context: Context) => getUsers(watching, context),
};

const publishableCollectionPeopleResolvers = {
  ...collectionPeopleResolvers,
  published_by: ({ published_by }, __, context: Context) => getUsers(published_by, context),
  last_published_by: ({ last_published_by }, __, context: Context) => getUsers(last_published_by, context),
};

const collection = {
  CollectionPeople: collectionPeopleResolvers,
  PublishableCollectionPeople: publishableCollectionPeopleResolvers,
  CollectionHistory: {
    user: ({ user }, __, context: Context) => getUsers(user, context),
  },
};

export { collection };
