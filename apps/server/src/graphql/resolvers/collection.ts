/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../server';
import { getUsers } from '../helpers';
import mongoose from 'mongoose';

const collectionPeopleResolvers = {
  created_by: ({ created_by }: { created_by: mongoose.Types.ObjectId }, __: never, context: Context) =>
    getUsers(created_by, context),
  modified_by: ({ modified_by }: { modified_by: mongoose.Types.ObjectId }, __: never, context: Context) =>
    getUsers(modified_by, context),
  last_modified_by: (
    { last_modified_by }: { last_modified_by: mongoose.Types.ObjectId },
    __: never,
    context: Context
  ) => getUsers(last_modified_by, context),
  watching: ({ watching }: { watching: mongoose.Types.ObjectId }, __: never, context: Context) =>
    getUsers(watching, context),
};

const publishableCollectionPeopleResolvers = {
  ...collectionPeopleResolvers,
  published_by: ({ published_by }: { published_by: mongoose.Types.ObjectId }, __: never, context: Context) =>
    getUsers(published_by, context),
  last_published_by: (
    { last_published_by }: { last_published_by: mongoose.Types.ObjectId },
    __: never,
    context: Context
  ) => getUsers(last_published_by, context),
};

const collection = {
  CollectionPeople: collectionPeopleResolvers,
  PublishableCollectionPeople: publishableCollectionPeopleResolvers,
  CollectionHistory: {
    user: ({ user }: { user: mongoose.Types.ObjectId }, __: never, context: Context) => getUsers(user, context),
  },
};

export { collection };
