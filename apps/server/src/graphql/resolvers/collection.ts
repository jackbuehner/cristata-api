/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import getFieldNames from 'graphql-list-fields';
import mongoose from 'mongoose';
import { getUsers } from '../helpers';
import { Context } from '../server';

type ObjectId = mongoose.Types.ObjectId;
type Info = Parameters<typeof getFieldNames>[0];

const collectionPeopleResolvers = {
  created_by: ({ created_by }: { created_by: ObjectId }, __: never, context: Context, info: Info) =>
    getUsers(created_by, context, info),
  modified_by: ({ modified_by }: { modified_by: ObjectId }, __: never, context: Context, info: Info) =>
    getUsers(modified_by, context, info),
  last_modified_by: (
    { last_modified_by }: { last_modified_by: ObjectId },
    __: never,
    context: Context,
    info: Info
  ) => getUsers(last_modified_by, context, info),
  watching: ({ watching }: { watching: ObjectId }, __: never, context: Context, info: Info) =>
    getUsers(watching, context, info),
};

const publishableCollectionPeopleResolvers = {
  ...collectionPeopleResolvers,
  published_by: ({ published_by }: { published_by: ObjectId }, __: never, context: Context, info: Info) =>
    getUsers(published_by, context, info),
  last_published_by: (
    { last_published_by }: { last_published_by: ObjectId },
    __: never,
    context: Context,
    info: Info
  ) => getUsers(last_published_by, context, info),
};

const collection = {
  CollectionPeople: collectionPeopleResolvers,
  PublishableCollectionPeople: publishableCollectionPeopleResolvers,
  CollectionHistory: {
    user: ({ user }: { user: ObjectId }, __: never, context: Context, info: Info) =>
      getUsers(user, context, info),
  },
};

export { collection };
