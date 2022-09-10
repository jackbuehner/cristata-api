import { notEmpty } from '@cristata/utils';
import mongoose from 'mongoose';
import { TenantDB } from '../../mongodb/TenantDB';
import { IUser, IUserDoc } from '../../mongodb/users';
import { Context } from '../server';

/**
 * Get the user or array of users from one or more unique user object IDs.
 */
async function getUsers(_ids: mongoose.Types.ObjectId, context: Context): Promise<IUserDoc | null>;
async function getUsers(_ids: mongoose.Types.ObjectId[], context: Context): Promise<IUserDoc[]>;
async function getUsers(
  _ids: mongoose.Types.ObjectId | mongoose.Types.ObjectId[],
  context: Context
): Promise<IUserDoc | IUserDoc[] | null> {
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const User = (await tenantDB.model<IUser>('User'))!;

  // if it is undefined
  if (!_ids) return [];
  // if it is an array of ObjectId
  if (Array.isArray(_ids)) {
    return (await Promise.all(_ids.map(async (_id) => await User.findById(_id)))).filter(notEmpty);
  }
  // if it just a single ObjectId
  const _id = _ids;
  return await User.findById(_id);
}

export { getUsers };
