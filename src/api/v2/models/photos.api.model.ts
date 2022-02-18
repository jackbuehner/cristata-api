import mongoose from 'mongoose';
import { Response } from 'express';
import { IPhoto, IPhotoDoc } from '../../../mongodb/photos.model';
import { IDeserializedUser } from '../../../passport';

/**
 * Post a new photo.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newPhoto(data: IPhoto, user: IDeserializedUser, res: Response = null): Promise<void> {
  const Photo = mongoose.model<IPhotoDoc>('Photo');

  const photo = new Photo({
    // set people data based on who created the document
    people: {
      uploaded_by: user._id,
      modified_by: [user._id],
      last_modified_by: user._id,
    },
    // set history data
    history: [{ type: 'created', user: user._id, at: new Date().toISOString() }],
    // include the other data about the document (can overwrite people data)
    ...data,
  });
  try {
    await photo.save();
    res ? res.json(photo) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all of the photos in the photos collection.
 *
 * @param user - the getting user's profile
 */
async function getPhotos(user: IDeserializedUser, query: URLSearchParams, res: Response = null): Promise<void> {
  const Photo = mongoose.model<IPhotoDoc>('Photo');

  // expose history type to the filter
  const historyType = query.getAll('historyType');

  // attempt to get all photos
  try {
    const photos = await Photo.aggregate([
      // filter by history type if defined
      {
        $match: historyType.length > 0 ? { history: { $elemMatch: { type: { $in: historyType } } } } : {},
      },
      // sort with newest docs first
      { $sort: { 'timestamps.created_at': -1 } },
    ]);
    res ? res.json(photos) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a photo by id.
 *
 * @param id - the id of the photo
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getPhoto(id: string, user: IDeserializedUser, res: Response = null): Promise<IPhotoDoc> {
  const Photo = mongoose.model<IPhotoDoc>('Photo');

  // get the document
  try {
    const photo = await Photo.findById(id, {});
    res
      ? photo
        ? res.json(photo)
        : res.status(404).json({ message: 'document does not exist or you do not have access' })
      : null;
    return photo;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a photo.
 *
 * @param id - the id of the photo
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param res - the response for an HTTP request
 */
async function patchPhoto(
  id: string,
  data: IPhoto,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  const Photo = mongoose.model<IPhotoDoc>('Photo');

  // if the current document does not exist, do not continue (use POST to create an document)
  const currentPhoto = (await getPhoto(id, user)).toObject();
  if (!currentPhoto) {
    const err =
      'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
    res.status(404).json({ message: err });
    console.error(err);
    return;
  }

  // determine the history type to set based on the hidden status
  const historyType = data.hidden ? 'hidden' : 'patched';

  // set modified_at, modified_by, and last_modified_by
  data = {
    ...data,
    people: {
      ...currentPhoto.people,
      ...data.people,
      modified_by: [...new Set([...currentPhoto.people.modified_by, user._id])], // adds the user to the array, and then removes duplicates
      last_modified_by: user._id,
    },
    timestamps: {
      ...currentPhoto.timestamps,
      ...data.timestamps,
      modified_at: new Date().toISOString(),
    },
    // set history data
    history: currentPhoto.history
      ? [...currentPhoto.history, { type: historyType, user: user._id, at: new Date().toISOString() }]
      : [{ type: historyType, user: user._id, at: new Date().toISOString() }],
    permissions: {
      ...currentPhoto.permissions,
      ...data.permissions,
    },
  };

  // attempt to patch the article
  try {
    await Photo.findByIdAndUpdate(id, { $set: data });
    res ? res.status(200).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a photo.
 *
 * @param id - the id of the photo
 * @param user - the deleting user's profile
 * @param res - the response for an HTTP request
 */
async function deletePhoto(id: string, user: IDeserializedUser, res = null): Promise<void> {
  const Photo = mongoose.model<IPhotoDoc>('Photo');

  // atempt to delete article
  try {
    await Photo.deleteOne({ _id: id });
    res ? res.status(204).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { newPhoto, getPhotos, getPhoto, patchPhoto, deletePhoto };
