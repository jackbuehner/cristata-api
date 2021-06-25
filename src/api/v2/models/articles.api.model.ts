import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { EnumArticleStage, IArticle, IArticleDoc } from '../../../mongodb/articles.model';
import { IProfile } from '../../../passport';

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
const Article = mongoose.model<IArticleDoc>('Article');

/**
 * Post a new article.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newArticle(data: IArticle, user: IProfile, res: Response = null): Promise<void> {
  const article = new Article({
    // set people data based on who created the document
    permissions: {
      users: [user.id],
      teams: [Groups.COPY_EDITOR, Groups.MANAGING_EDITOR],
    },
    people: {
      created_by: user.id,
      modified_by: [user.id],
      last_modified_by: user.id,
    },
    // include the other data about the document (can overwrite people data)
    ...data,
  });
  try {
    await article.save();
    res ? res.json(article) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all of the articles in the articles collection.
 *
 * @param user - the getting user's profile
 */
async function getArticles(user: IProfile, res: Response = null): Promise<void> {
  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? {}
    : { $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

  // attempt to get all articles
  try {
    const articles = await Article.find(filter);
    res ? res.json(articles) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a article by id or name.
 *
 * @param id - the id or name of the article
 * @param by - _name_ or _id_ (default: _id_)
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getArticle(id: string, by: string, user: IProfile, res: Response = null): Promise<IArticleDoc> {
  // if by is name, use 'name' as method; otherwise, use '_id' as method
  const method = by === 'name' ? 'name' : '_id';

  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { [method]: id }
    : { [method]: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

  // not found message
  const noMatchMessage = user.teams.includes(adminTeamID)
    ? 'document does not exist'
    : 'document does not exist or you do not have access';

  // get the article
  try {
    const article = await Article.findOne(filter);
    res ? (article ? res.json(article) : res.status(404).json({ message: noMatchMessage })) : null;
    return article;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a article.
 *
 * @param id - the id of the article
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param canPublish - whether the user has publish permissions
 * @param res - the response for an HTTP request
 */
async function patchArticle(
  id: string,
  data: IArticle,
  user: IProfile,
  canPublish = false,
  res: Response = null
): Promise<void> {
  // if the current document does not exist, do not continue (use POST to create an document)
  const currentArticle = await getArticle(id, 'id', user);
  if (!currentArticle) {
    const err =
      'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
    res.status(404).json({ message: err });
    console.error(err);
    return;
  }

  // if the article's current state is uploaded or published, do not patch article unless user canPublish
  const isUploaded = currentArticle.stage === (EnumArticleStage.UPLOADED || EnumArticleStage.PUBLISHED);
  if (isUploaded && !canPublish) {
    const err = 'you do not have permission to modify a published document';
    res.status(403).json({ message: err });
    console.error(err);
    return;
  }

  // admin: full access
  // others: only patch documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { _id: id }
    : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

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
  };

  console.log(data);

  // attempt to patch the article
  try {
    await Article.updateOne(filter, { $set: data });
    res ? res.status(200).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a article.
 *
 * @param id - the id of the article
 * @param user - the deleting user's profile
 * @param canPublish - whether the user has publish permissions
 * @param res - the response for an HTTP request
 */
async function deleteArticle(id: string, user: IProfile, canPublish = false, res = null): Promise<void> {
  // if the article's current state is uploaded or published, do not patch article unless user canPublish
  const currentArticle = await getArticle(id, 'id', user);
  if (currentArticle) {
    const isUploaded = currentArticle.stage === (EnumArticleStage.UPLOADED || EnumArticleStage.PUBLISHED);
    if (isUploaded && !canPublish) {
      const err = 'you do not have permission to modify a published document';
      res.status(403).json({ message: err });
      console.error(err);
      return;
    }
  }

  // admin: can delete any document
  // others: can only delete documents for which the user has access (by team or userID)
  const filter = user.teams.includes(adminTeamID)
    ? { _id: id }
    : { _id: id, $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };

  // atempt to delete article
  try {
    await Article.deleteOne(filter);
    res ? res.status(204).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { newArticle, getArticles, getArticle, patchArticle, deleteArticle };
