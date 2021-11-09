import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { IProfile } from '../../../passport';
import { flattenObject } from '../../../utils/flattenObject';
import { replaceGithubIdWithUserObj } from '../helpers';
import { IFlush, IFlushDoc } from '../../../mongodb/flush.model';

// load environmental variables
dotenv.config();
const adminTeamID = process.env.GITHUB_ORG_ADMIN_TEAM_ID;

// define model
const Document = mongoose.model<IFlushDoc>('Flush');

/**
 * Post a new document.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newDocument(data: IFlush, user: IProfile, res: Response = null): Promise<void> {
  try {
    const doc = new Document({
      permissions: {
        ...data.permissions,
        users: [parseInt(user.id)],
      },
      people: {
        ...data.people,
        created_by: parseInt(user.id),
        modified_by: [parseInt(user.id)],
        last_modified_by: parseInt(user.id),
      },
      // set history data
      history: [{ type: 'created', user: parseInt(user.id), at: new Date().toISOString() }],
      // include the other data about the document
      ...data,
    });

    await doc.save();
    if (res) res.json(doc);
  } catch (error) {
    console.error(error);
    if (res) res.status(400).json(error);
  }
}

/**
 * Get all of the documents in the collection.
 *
 * @param user - the getting user's profile
 */
async function getDocuments(user: IProfile, query: URLSearchParams, res: Response = null): Promise<void> {
  try {
    // expose history type to the filter
    const historyType = query.getAll('historyType');

    // aggregation pipline
    const pipeline = [
      {
        // admin: full access
        // others: only get documents for which the user has access (by team or userID)
        $match: user.teams.includes(adminTeamID)
          ? {}
          : { $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': parseInt(user.id) }] },
      },
      // filter by history type if defined
      {
        $match: historyType.length > 0 ? { history: { $elemMatch: { type: { $in: historyType } } } } : {},
      },
      // replace user ids in the people object with full profiles from the users colletion
      ...replaceGithubIdWithUserObj(
        [
          ...new Set(
            Object.keys(flattenObject(Document.schema.obj))
              .filter((key) => key.includes('people.obj'))
              .map((key) => key.replace('.type', '').replace('.default', '').replace('.obj', ''))
          ),
        ],
        'Flush'
      ),
    ];

    // attempt to get all matching documents
    const docs = await Document.aggregate(pipeline);
    if (res) res.json(docs);
  } catch (error) {
    console.error(error);
    if (res) res.status(400).json(error);
  }
}

/**
 * Get a document by id.
 *
 * @param id - the id of the doc
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getDocument(id: string, user: IProfile, res: Response = null): Promise<IFlushDoc> {
  try {
    // admin: full access
    // others: only get documents for which the user has access (by team or userID)
    const filter = user.teams.includes(adminTeamID)
      ? { _id: new mongoose.Types.ObjectId(id) }
      : {
          _id: new mongoose.Types.ObjectId(id),
          $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': parseInt(user.id) }],
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
      ...replaceGithubIdWithUserObj(
        [
          ...new Set(
            Object.keys(flattenObject(Document.schema.obj))
              .filter((key) => key.includes('people.obj'))
              .map((key) => key.replace('.type', '').replace('.default', '').replace('.obj', ''))
          ),
        ],
        'Article'
      ),
    ];

    // get the document
    const docs = await Document.aggregate(pipeline);
    if (res) docs?.length > 0 ? res.json(docs[0]) : res.status(404).json({ message: noMatchMessage });
    else return await Document.findOne(filter);
  } catch (error) {
    console.error(error);
    if (res) res.status(400).json(error);
  }
}

/**
 * Patch a document.
 *
 * @param id - the id of the document
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param canPublish - whether the user has publish permissions
 * @param res - the response for an HTTP request
 */
async function patchDocument(
  id: string,
  data: IFlush,
  user: IProfile,
  canPublish = false,
  res: Response = null
): Promise<void> {
  try {
    // if the current document does not exist, do not continue (use POST to create an document)
    const currentDoc = (await getDocument(id, user)).toObject();
    if (!currentDoc) {
      const err =
        'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
      res.status(404).json({ message: err });
      console.error(err);
      return;
    }

    // do not patch do document unless user canPublish
    if (!canPublish) {
      const err = 'you do not have permission to publish or modify a published document';
      res.status(403).json({ message: err });
      console.error(err);
      return;
    }

    // admin: full access
    // others: only patch documents for which the user has access (by team or userID)
    const filter = user.teams.includes(adminTeamID)
      ? { _id: id }
      : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

    // determine the history type to set based on the stage or hidden status
    const historyType = data.hidden ? 'hidden' : data.timestamps?.published_at ? 'published' : 'patched';

    // set modified_at, modified_by, and last_modified_by
    data = {
      ...data,
      people: {
        ...currentDoc.people,
        ...data.people,
        modified_by: [...new Set([...currentDoc.people.modified_by, parseInt(user.id)])], // adds the user to the array, and then removes duplicates
        last_modified_by: parseInt(user.id),
      },
      timestamps: {
        ...currentDoc.timestamps,
        ...data.timestamps,
        modified_at: new Date().toISOString(),
      },
      // set history data
      history: currentDoc.history
        ? [...currentDoc.history, { type: historyType, user: parseInt(user.id), at: new Date().toISOString() }]
        : [{ type: historyType, user: parseInt(user.id), at: new Date().toISOString() }],
      permissions: {
        ...currentDoc.permissions,
        ...data.permissions,
      },
    };

    // attempt to patch the document
    await Document.updateOne(filter, { $set: data });
    if (res) res.status(200).send();
  } catch (error) {
    console.error(error);
    if (res) res.status(400).json(error);
  }
}

/**
 * Watch a document.
 *
 * @param id - the id of the article
 * @param user - the patching user's profile
 * @param watch - whether to watch the article
 * @param res - the response for an HTTP request
 */
async function watchDocument(id: string, user: IProfile, watch: boolean, res: Response = null): Promise<void> {
  try {
    // if the current document does not exist, do not continue
    const currentDoc = (await getDocument(id, user)).toObject();
    if (!currentDoc) {
      const err = 'the existing document does not exist or you do not have access';
      res.status(404).json({ message: err });
      console.error(err);
      return;
    }

    // admin: full access
    // others: only watch documents for which the user has access (by team or userID)
    const filter = user.teams.includes(adminTeamID)
      ? { _id: id }
      : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

    // get the current watchers, and then modify the array to either include or exclude the user based on whether they want to watch the document
    let watching = currentDoc.people.watching;
    if (watch) {
      watching = [...new Set([...currentDoc.people.watching, parseInt(user.id)])]; // adds the user to the array, and then removes duplicates
    } else {
      watching = currentDoc.people.watching.filter((github_id) => github_id !== parseInt(user.id));
    }

    // attempt to patch the document
    await Document.updateOne(filter, { $set: { 'people.watching': watching } });
    if (res) res.status(200).send();
  } catch (error) {
    console.error(error);
    if (res) res.status(400).json(error);
  }
}

export { newDocument, getDocument, getDocuments, patchDocument, watchDocument };
