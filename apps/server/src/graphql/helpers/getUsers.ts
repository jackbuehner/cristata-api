import { notEmpty } from '@jackbuehner/cristata-utils';
import getFieldNames from 'graphql-list-fields';
import mongoose from 'mongoose';
import { TenantDB } from '../../mongodb/TenantDB';
import { IUser, IUserDoc } from '../../mongodb/users';
import { Context } from '../server';

type GraphQLResolveInfo = Parameters<typeof getFieldNames>[0];

/**
 * Get the user or array of users from one or more unique user object IDs.
 */
async function getUsers(
  _ids: mongoose.Types.ObjectId,
  context: Context,
  info?: GraphQLResolveInfo | string[]
): Promise<IUserDoc | null>;
async function getUsers(
  _ids: mongoose.Types.ObjectId[],
  context: Context,
  info?: GraphQLResolveInfo | string[]
): Promise<IUserDoc[]>;
async function getUsers(
  _ids: mongoose.Types.ObjectId | mongoose.Types.ObjectId[],
  context: Context,
  info?: GraphQLResolveInfo | string[]
): Promise<IUserDoc | IUserDoc[] | null> {
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const User = (await tenantDB.model<IUser>('User'))!;

  const [projection, fields] = createProjection(info);
  const isOnlyId = fields.length === 1 && fields[0] === '_id';

  // if it is undefined
  if (!_ids) return [];

  // if the client only wants the _id field, we do not need to query the database
  if (isOnlyId) {
    if (Array.isArray(_ids)) return _ids.map((_id) => ({ _id } as IUserDoc));
    return { _id: _ids } as IUserDoc;
  }

  // if it is an array of ObjectId
  if (Array.isArray(_ids)) {
    return (await Promise.all(_ids.map(async (_id) => await User.findById(_id, projection)))).filter(notEmpty);
  }

  // if it just a single ObjectId
  const _id = _ids;
  return await User.findById(_id, projection);
}

/**
 * Creates a projection that only fetches the document fields
 * requested in the GraphQL query.
 */
function createProjection(info?: GraphQLResolveInfo | string[]): [Record<string, 1> | undefined, string[]] {
  if (!info) return [undefined, []];

  // get the names of the requested fields
  const fields = Array.isArray(info) ? info : getFieldNames(info).map((field) => field.replace('docs.', ''));

  const projection: Record<string, 1> = {};
  fields.forEach((field) => {
    projection[field] = 1;
  });

  return [projection, fields];
}

export { getUsers };
