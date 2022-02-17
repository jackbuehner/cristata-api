/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { getUsers } from '../helpers';

const collectionPeopleResolvers = {
  created_by: ({ created_by }) => getUsers(created_by),
  modified_by: ({ modified_by }) => getUsers(modified_by),
  last_modified_by: ({ last_modified_by }) => getUsers(last_modified_by),
  watching: ({ watching }) => getUsers(watching),
};

const publishableCollectionPeopleResolvers = {
  ...collectionPeopleResolvers,
  published_by: ({ published_by }) => getUsers(published_by),
  last_published_by: ({ last_published_by }) => getUsers(last_published_by),
};

const collection = {
  CollectionPeople: collectionPeopleResolvers,
  PublishableCollectionPeople: publishableCollectionPeopleResolvers,
  CollectionHistory: {
    user: ({ user }) => getUsers(user),
  },
};

export { collection };
