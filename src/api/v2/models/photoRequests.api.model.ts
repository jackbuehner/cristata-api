import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { EnumPhotoRequestStage, IPhotoRequest, IPhotoRequestDoc } from '../../../mongodb/photoRequests.model';
import { IDeserializedUser } from '../../../passport';
import { replaceObjectIdWithUserObj } from '../helpers';

// load environmental variables
dotenv.config();
const adminTeamID = process.env.GITHUB_ORG_ADMIN_TEAM_ID;

// permissions groups
enum Groups {
  ADMIN = 'MDQ6VGVhbTQ2NDI0MTc=',
  BOARD = 'MDQ6VGVhbTQ3MzA5ODU=',
  MANAGING_EDITOR = 'MDQ6VGVhbTQ5MDMxMTY=',
  COPY_EDITOR = 'MDQ6VGVhbTQ4MzM5MzU=',
  STAFF_WRITER = 'MDQ6VGVhbTQ5MDMxMTg=',
  CONTRIBUTOR = 'MDQ6VGVhbTQ5MDMxMjA=',
}

// define model
const PhotoRequest = mongoose.model<IPhotoRequestDoc>('PhotoRequest');

/**
 * Post a new photo reqeust.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newPhotoRequest(
  data: IPhotoRequest,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  const photoRequest = new PhotoRequest({
    // set people data based on who created the document
    permissions: {
      users: [user._id],
      teams: [Groups.MANAGING_EDITOR],
    },
    people: {
      created_by: user._id,
      modified_by: [user._id],
      last_modified_by: user._id,
    },
    // set history data
    history: [{ type: 'created', user: user._id, at: new Date().toISOString() }],
    // include the other data about the document (can overwrite people data)
    ...data,
  });
  try {
    await photoRequest.save();
    res ? res.json(photoRequest) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all of the photo requests in the photo requests collection.
 *
 * @param user - the getting user's profile
 */
async function getPhotoRequests(
  user: IDeserializedUser,
  query: URLSearchParams,
  res: Response = null
): Promise<void> {
  // expose history type to the filter
  const historyType = query.getAll('historyType');

  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter: Record<string, unknown> = user.teams.includes(adminTeamID)
    ? {}
    : { $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user._id }] };
  if (historyType.length > 0) {
    filter.history = { $elemMatch: { type: { $in: historyType } } };
  }

  // aggregation pipline
  const pipeline = [
    {
      // admin: full access
      // others: only get documents for which the user has access (by team or userID)
      $match: filter,
    },
    // replace user ids in the people object with full profiles from the users colletion
    ...replaceObjectIdWithUserObj(
      Object.keys(
        (PhotoRequest.schema.obj.people as { type: { obj: IPhotoRequestDoc['people'] } }).type.obj
      ).map((key) => `people.${key}`),
      'PhotoRequest'
    ),
  ];

  // attempt to get all articles
  try {
    const photoRequests = await PhotoRequest.aggregate(pipeline);
    res ? res.json(photoRequests) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a photo request by id.
 *
 * @param id - the id of the photo request
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getPhotoRequest(
  id: string,
  user: IDeserializedUser,
  res: Response = null
): Promise<IPhotoRequestDoc> {
  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { _id: new mongoose.Types.ObjectId(id) }
    : {
        _id: new mongoose.Types.ObjectId(id),
        $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user._id }],
      };

  // not found message
  const noMatchMessage = user.teams.includes(adminTeamID)
    ? 'document does not exist'
    : 'document does not exist or you do not have access';

  // aggregation pipline
  const pipeline = [
    {
      // admin: full access
      // others: only get documents for which the user has access (by team or userID)
      $match: filter,
    },
    // replace user ids in the people object with full profiles from the users colletion
    ...replaceObjectIdWithUserObj(
      Object.keys(
        (PhotoRequest.schema.obj.people as { type: { obj: IPhotoRequestDoc['people'] } }).type.obj
      ).map((key) => `people.${key}`),
      'PhotoRequest'
    ),
  ];

  // get the photo request document
  try {
    const photoRequests = await PhotoRequest.aggregate(pipeline);
    if (res)
      photoRequests?.length > 0
        ? res.json(photoRequests[0])
        : res.status(404).json({ message: noMatchMessage });
    return await PhotoRequest.findOne(filter);
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a photo request.
 *
 * @param id - the id of the photo request
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param res - the response for an HTTP request
 */
async function patchPhotoRequest(
  id: string,
  data: IPhotoRequest,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  // if the current document does not exist, do not continue (use POST to create an document)
  const currentPhotoRequest = (await getPhotoRequest(id, user)).toObject();
  if (!currentPhotoRequest) {
    const err =
      'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
    res.status(404).json({ message: err });
    console.error(err);
    return;
  }

  // admin: full access
  // others: only patch documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { _id: id }
    : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user._id }] };

  // determine the history type to set based on the stage or hidden status
  const historyType = data.hidden
    ? 'hidden'
    : data.stage === EnumPhotoRequestStage.FULFILLED
    ? 'fulfilled'
    : 'patched';

  // set modified_at, modified_by, and last_modified_by
  data = {
    ...data,
    people: {
      ...currentPhotoRequest.people,
      ...data.people,
      modified_by: [...new Set([...currentPhotoRequest.people.modified_by, user._id])], // adds the user to the array, and then removes duplicates
      last_modified_by: user._id,
    },
    timestamps: {
      ...data.timestamps,
      modified_at: new Date().toISOString(),
    },
    // set history data
    history: currentPhotoRequest.history
      ? [...currentPhotoRequest.history, { type: historyType, user: user._id, at: new Date().toISOString() }]
      : [{ type: historyType, user: user._id, at: new Date().toISOString() }],
    permissions: {
      ...currentPhotoRequest.permissions,
      ...data.permissions,
    },
  };

  // attempt to patch the article
  try {
    await PhotoRequest.updateOne(filter, { $set: data });
    res ? res.status(200).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a photo request.
 *
 * @param id - the id of the photo request
 * @param user - the deleting user's profile
 * @param res - the response for an HTTP request
 */
async function deletePhotoRequest(id: string, user: IDeserializedUser, res = null): Promise<void> {
  // admin: can delete any document
  // others: can only delete documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { _id: id }
    : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user._id }] };

  // atempt to delete article
  try {
    await PhotoRequest.deleteOne(filter);
    res ? res.status(204).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { newPhotoRequest, getPhotoRequests, getPhotoRequest, patchPhotoRequest, deletePhotoRequest };
