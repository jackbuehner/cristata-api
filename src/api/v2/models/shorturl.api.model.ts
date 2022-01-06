import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { IShortURL, IShortURLDoc } from '../../../mongodb/shorturl.model';
import { IDeserializedUser } from '../../../passport';
import { customAlphabet } from 'nanoid/async';
import { Teams } from '../../../config/database';

const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7);

// load environmental variables
dotenv.config();
const shortURLTeamID = Teams.SHORTURL;

// define model
const ShortURL = mongoose.model<IShortURLDoc>('ShortURL');

/**
 * Post a new short url.
 *
 * __The user must be part of the short url team to create a short url.__
 *
 * __Any user can see created short urls.__
 *
 * @param data data permitted/required by the schema
 * @param user the getting user's profile
 */
async function newShortURL(data: IShortURL, user: IDeserializedUser, res: Response = null): Promise<void> {
  try {
    if (user.teams.includes(shortURLTeamID)) {
      // generate a code
      const code = await generateCode();
      // create a document with the data argument
      const document = new ShortURL({
        ...data,
        code: code,
        domain: 'flusher.page',
        original_url: '__',
      });
      // save the document to the database
      await document.save();
      // if this was a request from a client, send the saved document
      res ? res.json(document) : null;
    } else {
      // send error 403 if the user is not part of the short url team
      res ? res.status(403).send() : null;
    }
  } catch (error) {
    // log and send errors if they occur
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a short url by code
 *
 * __Any user may see short urls.__
 *
 * @param code - the code of the shorturl
 * @param res - the response for an HTTP request
 */
async function getShortURL(code: string, res: Response = null): Promise<void> {
  try {
    // find the document using the shorturl code
    const document = await ShortURL.findOne({ code });
    if (document) {
      // if found, send it to the client
      res ? res.json(document) : null;
    } else {
      // otherwise, tell the cient it does not exist
      res ? res.status(400).json({ message: 'document does not exist' }) : null;
    }
  } catch (error) {
    // log and send errors if they occur
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all short urls saved to the database.
 *
 * __Any user may see short urls.__
 *
 * @param res - the response for an HTTP request
 */
async function getShortURLs(res: Response = null): Promise<void> {
  try {
    // get all shorturl documents by passing an empty filter ({})
    const documents = await ShortURL.find({});
    if (documents) {
      // if there are documents, send them to the client
      res ? res.json(documents) : null;
    } else {
      // otherwise, send an error to the client
      res ? res.status(400).end() : null;
    }
  } catch (error) {
    // log and send errors if they occur
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a short url document.
 *
 * __The user must be part of the short url team to modify a short url.__
 *
 * @param code - the short url code
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param res - the response for an HTTP request
 */
async function patchShortURL(
  code: string,
  data: IShortURL,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  try {
    if (user.teams.includes(shortURLTeamID)) {
      // add timestamps and user id to the changed data
      data = {
        ...data,
        timestamps: {
          ...data.timestamps,
          modified_at: new Date().toISOString(),
        },
        people: {
          ...data.people,
          modified_by: [...new Set([...data.people.modified_by, user._id])], // adds the user to the array, and then removes duplicates
          last_modified_by: user._id,
        },
      };

      // update the short url document
      // find the document by code
      // merge the changes from `data` with existing data in the document
      await ShortURL.updateOne({ code }, { $set: data });

      // let the client know the patch was successful
      res ? res.status(200).send() : null;
    }
  } catch (error) {
    // log and send errors if they occur
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a short url document.
 *
 * __The user must be part of the short url team to delete a short url.__
 *
 * @param code - the short url code
 * @param user - the deleting user's profile
 * @param res - the response for an HTTP request
 */
async function deleteShortURL(code: string, user: IDeserializedUser, res = null): Promise<void> {
  try {
    if (user.teams.includes(shortURLTeamID)) {
      // delete the short url document
      await ShortURL.deleteOne({ code });

      // tell the client that the document has been deleted
      res ? res.status(204).send() : null;
    }
  } catch (error) {
    // log and send errors if they occur
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { newShortURL, getShortURL, getShortURLs, patchShortURL, deleteShortURL };
