import mongoose from 'mongoose';
import { Response } from 'express';
import { IUser, IUserDoc } from '../../../mongodb/users.model';
import { IProfile } from '../../../passport';

// define model
const User = mongoose.model<IUserDoc>('User');

// NOTE: there is no POST method for a new user because it is
// automatically handled in passport.ts

/**
 * Get all of the users in the user collection.
 */
async function getUsers(res: Response = null): Promise<void> {
  try {
    const users = await User.find();
    res ? res.json(users) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a user in the user collection.
 */
async function getUser(id: string, authUser: IProfile, res: Response = null): Promise<void> {
  try {
    const user =
      id === 'me'
        ? await User.findOne({ github_id: parseInt(authUser.id) })
        : mongoose.Types.ObjectId.isValid(id)
        ? await User.findById(id)
        : await User.findOne({ github_id: parseInt(id) });
    res ? res.json(user) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a user in the user collection.
 */
async function patchUser(
  id: string,
  github_id: string,
  data: IUser,
  user: IProfile,
  res: Response = null
): Promise<void> {
  // attempt to patch the article
  try {
    const currentVersion = (await User.findById(id)).toObject();

    data = {
      ...data,
      timestamps: {
        ...data.timestamps,
        modified_at: new Date().toISOString(),
      },
      people: {
        ...data.people,
        modified_by: [...new Set([...currentVersion.people.modified_by, parseInt(user.id)])], // adds the user to the array, and then removes duplicates
        last_modified_by: parseInt(user.id),
      },
      versions: currentVersion.versions ? [...currentVersion.versions, currentVersion] : [currentVersion],
    };

    await User.findByIdAndUpdate(id, { $set: data });
    res ? res.status(200).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a user photo in the user collection.
 */
async function getUserPhoto(id: string, authUser: IProfile, res: Response = null): Promise<void> {
  try {
    const user =
      id === 'me'
        ? await User.findOne({ github_id: parseInt(authUser.id) })
        : mongoose.Types.ObjectId.isValid(id)
        ? await User.findById(id)
        : await User.findOne({ github_id: parseInt(id) });
    res ? res.redirect(user.photo) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get select information about a user
 */
async function getPublicUser(slug: string, res: Response = null): Promise<void> {
  try {
    const user = await User.aggregate([
      {
        $match: { slug: slug },
      },
      { $limit: 1 },
      {
        $unset: ['timestamps', 'people', 'teams', '__v', 'phone', 'versions'],
      },
    ]);
    res ? (user ? res.json(user[0]) : res.status(404).end()) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get select information about all users
 */
async function getPublicUsers(query: URLSearchParams, res: Response = null): Promise<void> {
  // expose queries
  const gte = parseInt(query.get('gte')) || 0;
  const lt = parseInt(query.get('lt')) || 100;

  try {
    const users = await User.aggregate([
      {
        $match: {
          $and: [{ group: { $gte: gte } }, { group: { $lt: lt } }],
        },
      },
      { $sort: { group: 1 } },
      {
        $unset: ['timestamps', 'people', 'teams', '__v', 'phone', 'versions'],
      },
    ]);

    res ? (users ? res.json(users) : res.status(404).end()) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { getUsers, getUser, patchUser, getUserPhoto, getPublicUser, getPublicUsers };
