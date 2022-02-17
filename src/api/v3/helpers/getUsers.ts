import mongoose from 'mongoose';
import { IUser, IUserDoc } from '../../../config/collections/users';

/**
 * Get the user or array of users from one or more unique user object IDs.
 */
async function getUsers(
  _ids: mongoose.Types.ObjectId | mongoose.Types.ObjectId[]
): Promise<IUserDoc | IUserDoc[]> {
  // if it is undefined
  if (!_ids) return null;
  // if it is an array of ObjectId
  if (Array.isArray(_ids)) {
    return await Promise.all(_ids.map(async (_id) => await mongoose.model<IUser>('User').findById(_id)));
  }
  // if it just a single ObjectId
  const _id = _ids;
  return await mongoose.model<IUser>('User').findById(_id);
}

export { getUsers };
