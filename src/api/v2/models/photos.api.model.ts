import mongoose from 'mongoose';
import { Response } from 'express';
import { IPhoto, IPhotoDoc } from '../../../mongodb/photos.model';
import { IProfile } from '../../../passport';

// define model
const Photo = mongoose.model<IPhotoDoc>('Photo');

/**
 * Post a new photo.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newPhoto(data: IPhoto, user: IProfile, res: Response = null): Promise<void> {
  const photo = new Photo({
    // set people data based on who created the document
    people: {
      uploaded_by: parseInt(user.id),
      modified_by: [parseInt(user.id)],
      last_modified_by: parseInt(user.id),
    },
    // set history data
    history: [{ type: 'created', user: parseInt(user.id) }],
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
async function getPhotos(user: IProfile, query: URLSearchParams, res: Response = null): Promise<void> {
  // expose history type to the filter
  const historyType = query.getAll('historyType');
  console.log(historyType);

  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter: Record<string, unknown> = {};
  if (historyType.length > 0) {
    filter.history = { $elemMatch: { type: { $in: historyType } } };
  }

  // attempt to get all photos
  try {
    const photos = await Photo.find(filter);
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
async function getPhoto(id: string, user: IProfile, res: Response = null): Promise<IPhotoDoc> {
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
async function patchPhoto(id: string, data: IPhoto, user: IProfile, res: Response = null): Promise<void> {
  // if the current document does not exist, do not continue (use POST to create an document)
  const currentPhoto = await getPhoto(id, user);
  if (!currentPhoto) {
    const err =
      'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
    res.status(404).json({ message: err });
    console.error(err);
    return;
  }

  // set modified_at, modified_by, and last_modified_by
  data = {
    ...data,
    people: {
      ...data.people,
      modified_by: [...new Set([...data.people.modified_by, parseInt(user.id)])], // adds the user to the array, and then removes duplicates
      last_modified_by: parseInt(user.id),
    },
    timestamps: {
      ...data.timestamps,
      modified_at: new Date().toISOString(),
    },
    // set history data
    history: data.history
      ? [...data.history, { type: data.hidden ? 'hidden' : 'patched', user: parseInt(user.id) }]
      : [{ type: data.hidden ? 'hidden' : 'patched', user: parseInt(user.id) }],
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
async function deletePhoto(id: string, user: IProfile, res = null): Promise<void> {
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
