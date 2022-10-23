/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import getFieldNames from 'graphql-list-fields';
import { IUserDoc } from '../../mongodb/users';
import mongoose from 'mongoose';
import { getUsers } from '../helpers';
import { Context } from '../server';

type ObjectId = mongoose.Types.ObjectId;
type Info = Parameters<typeof getFieldNames>[0];

type PeopleResolverGroup = Record<
  string,
  (
    parent: Record<string, unknown>,
    args: never,
    context: Context,
    info: Info
  ) => Promise<IUserDoc | IUserDoc[] | null>
>;

const collectionPeopleResolvers: PeopleResolverGroup = {
  created_by: (parent, __, context, info) => getUsers(parent.created_by as ObjectId, context, info),
  modified_by: (parent, __, context, info) => getUsers(parent.modified_by as ObjectId, context, info),
  last_modified_by: (parent, __, context, info) => getUsers(parent.last_modified_by as ObjectId, context, info),
  watching: (parent, __, context, info) => getUsers(parent.watching as ObjectId, context, info),
};

const publishableCollectionPeopleResolvers: PeopleResolverGroup = {
  ...collectionPeopleResolvers,
  published_by: (parent, __, context, info) => getUsers(parent.published_by as ObjectId, context, info),
  last_published_by: (parent, __, context, info) =>
    getUsers(parent.last_published_by as ObjectId, context, info),
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
export type { PeopleResolverGroup };
