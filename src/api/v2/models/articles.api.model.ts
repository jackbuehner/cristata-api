import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { EnumArticleStage, IArticle, IArticleDoc } from '../../../mongodb/articles.model';
import { IProfile } from '../../../passport';
import { slugify } from '../../../utils/slugify';
import { ISettings } from '../../../mongodb/settings.model';
import { IUserDoc } from '../../../mongodb/users.model';
import { sendEmail } from '../../../utils/sendEmail';
import { flattenObject } from '../../../utils/flattenObject';
import { replaceGithubIdWithUserObj } from '../helpers';

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
      users: [parseInt(user.id)],
      teams: [Groups.COPY_EDITOR, Groups.MANAGING_EDITOR],
    },
    people: {
      created_by: parseInt(user.id),
      modified_by: [parseInt(user.id)],
      last_modified_by: parseInt(user.id),
    },
    // set history data
    history: [{ type: 'created', user: parseInt(user.id), at: new Date().toISOString() }],
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
async function getArticles(user: IProfile, query: URLSearchParams, res: Response = null): Promise<void> {
  // expose history type to the filter
  const historyType = query.getAll('historyType');

  // aggregation pipline
  const pipeline = [
    {
      // admin: full access
      // others: only get documents for which the user has access (by team or userID)
      $match: user.teams.includes(adminTeamID)
        ? {}
        : { $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] },
    },
    // filter by history type if defined
    {
      $match: historyType.length > 0 ? { history: { $elemMatch: { type: { $in: historyType } } } } : {},
    },
    // replace user ids in the people object with full profiles from the users colletion
    ...replaceGithubIdWithUserObj(
      [
        ...new Set(
          Object.keys(flattenObject(Article.schema.obj))
            .filter((key) => key.includes('people'))
            .map((key) => key.replace('.type', '').replace('.default', ''))
        ),
      ],
      'Article'
    ),
  ];

  // attempt to get all articles
  try {
    const articles = await Article.aggregate(pipeline);
    res ? res.json(articles) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

const publicUnset = [
  'stage',
  'locked',
  'hidden',
  'article_id',
  'history',
  'permissions',
  'versions',
  'people.created_by',
  'people.editors',
  'people.last_modified_by',
  'people.modified_by',
  'people.published_by',
  'timestamps.created_at',
  'timestamps.modified_at',
  'timestamps.target_publish_at',
  '__v',
  'people.authors.people',
  'people.authors.timestamps',
  'people.authors.teams',
  'people.authors.github_id',
  'people.authors.__v',
  'people.authors.phone',
  'people.authors.versions',
  'people.watching',
  'photoObj',
];

/**
 * Get all of the published articles in the articles collection.
 */
async function getPublicArticles(query: URLSearchParams, res: Response = null): Promise<void> {
  // expose queries
  const categories = query.getAll('category');
  const authors = query.getAll('author').map((author) => parseInt(author)); // convert each string to an integer
  const page = parseInt(query.get('page')) || 1;
  const limit = parseInt(query.get('limit')) || 10;
  const featured = Boolean(query.get('featured')) || false;

  // get the ids of the featured articles
  const featuredIds: mongoose.Types.ObjectId[] = [];
  if (featured) {
    const result = await mongoose.model<ISettings>('Settings').findOne({ name: 'featured-articles' });
    const ids = result.setting as unknown as { [key: string]: string };
    featuredIds.push(mongoose.Types.ObjectId(ids.first));
    featuredIds.push(mongoose.Types.ObjectId(ids.second));
    featuredIds.push(mongoose.Types.ObjectId(ids.third));
    featuredIds.push(mongoose.Types.ObjectId(ids.fourth));
  }

  try {
    const articles = Article.aggregate([
      {
        $match:
          categories.length > 0
            ? { categories: { $in: categories }, stage: 5.2 }
            : { categories: { $exists: true }, stage: 5.2 },
      },
      {
        $match: authors.length > 0 ? { 'people.authors': { $in: authors } } : {},
      },
      {
        $match: featured && featuredIds.length > 0 ? { _id: { $in: featuredIds } } : {},
      },
      {
        $match: { 'timestamps.published_at': { $lt: new Date() } },
      },
      {
        $addFields:
          featuredIds.length > 0
            ? { featured_order: { $indexOfArray: [featuredIds, '$_id'] } }
            : { featured_order: null },
      },
      { $sort: featuredIds.length > 0 ? { featured_order: 1 } : { 'timestamps.published_at': -1 } },
      {
        // replace author ids with full profiles from the users collection
        $lookup: {
          from: 'users',
          localField: 'people.authors',
          foreignField: 'github_id',
          as: 'people.authors',
        },
      },
      {
        // get the photo details from the photos collection
        $lookup: {
          from: 'photos',
          localField: 'photo_path',
          foreignField: 'photo_url',
          as: 'photoObj',
        },
      },
      {
        // set the photo source as a new field so that `photoObj` can be deleted
        $addFields: {
          photo_credit: { $first: '$photoObj.people.photo_created_by' },
        },
      },
      {
        $unset: publicUnset,
      },
    ]);

    // @ts-expect-error aggregatePaginate DOES exist. The types for the plugin have not been updated for newer versions of mongoose.
    const paginatedArticles = await Article.aggregatePaginate(articles, { page, limit });

    res ? res.json(paginatedArticles) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all a published article from the articles collection.
 */
async function getPublicArticle(slug: string, res: Response = null): Promise<void> {
  try {
    const article = await Article.aggregate([
      {
        $match: { slug: slug, stage: 5.2 },
      },
      {
        $match: { 'timestamps.published_at': { $lt: new Date() } },
      },
      { $sort: { 'timestamps.published_at': -1 } },
      { $limit: 1 },
      {
        // replace author ids with full profiles from the users collection
        $lookup: {
          from: 'users',
          localField: 'people.authors',
          foreignField: 'github_id',
          as: 'people.authors',
        },
      },
      {
        // get the photo details from the photos collection
        $lookup: {
          from: 'photos',
          localField: 'photo_path',
          foreignField: 'photo_url',
          as: 'photoObj',
        },
      },
      {
        // set the photo source as a new field so that `photoObj` can be deleted
        $addFields: {
          photo_credit: { $first: '$photoObj.people.photo_created_by' },
        },
      },
      {
        $unset: publicUnset,
      },
    ]);
    res ? (article ? res.json(article[0]) : res.status(404).end()) : null;
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
    ? { [method]: method === '_id' ? new mongoose.Types.ObjectId(id) : id }
    : {
        [method]: method === '_id' ? new mongoose.Types.ObjectId(id) : id,
        $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }],
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
          Object.keys(flattenObject(Article.schema.obj))
            .filter((key) => key.includes('people'))
            .map((key) => key.replace('.type', '').replace('.default', ''))
        ),
      ],
      'Article'
    ),
  ];

  // get the article
  try {
    const articles = await Article.aggregate(pipeline);
    if (res) articles?.length > 0 ? res.json(articles[0]) : res.status(404).json({ message: noMatchMessage });
    return await Article.findOne(filter);
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
  try {
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
    const isUploaded =
      currentArticle.stage === (EnumArticleStage['Uploaded/Scheduled'] || EnumArticleStage.Published);
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

    // determine the history type to set based on the stage or hidden status
    const historyType = data.hidden
      ? 'hidden'
      : data.stage === EnumArticleStage.Published
      ? 'published'
      : data.stage === EnumArticleStage['Uploaded/Scheduled']
      ? 'uploaded'
      : 'patched';

    // set modified_at, modified_by, and last_modified_by
    data = {
      ...data,
      people: {
        ...currentArticle.people,
        ...data.people,
        modified_by: [...new Set([...currentArticle.people.modified_by, parseInt(user.id)])], // adds the user to the array, and then removes duplicates
        last_modified_by: parseInt(user.id),
      },
      timestamps: {
        ...currentArticle.timestamps,
        ...data.timestamps,
        modified_at: new Date().toISOString(),
      },
      // set history data
      history: currentArticle.history
        ? [
            ...currentArticle.history,
            { type: historyType, user: parseInt(user.id), at: new Date().toISOString() },
          ]
        : [{ type: historyType, user: parseInt(user.id), at: new Date().toISOString() }],
    };

    // update the publish time if the document is being published for the first time
    if (data.stage === EnumArticleStage.Published) {
      if (!currentArticle.timestamps.published_at && !data.timestamps.published_at) {
        // if the client did not provide a publish time and the article was not already published
        data.timestamps.published_at = new Date().toISOString();
      }
    }

    // set the slug if the document is being published and does not already have one
    if (data.stage === EnumArticleStage.Published && !data.slug) {
      data.slug = slugify(data.name || currentArticle.name);
    }

    // attempt to patch the article
    await Article.updateOne(filter, { $set: data });
    res ? res.status(200).send() : null;

    // send email alerts to the watchers if the stage changes
    if (data.people.watching && data.stage && data.stage !== currentArticle.stage) {
      // get emails of watchers
      const watchersEmails = await Promise.all(
        (data.people.watching || currentArticle.people.watching).map(async (github_id) => {
          const profile = await mongoose.model<IUserDoc>('User').findOne({ github_id }); // get the profile, which may contain an email
          return profile.email;
        })
      );

      // get emails of authors and primary editors (if there are any) - mandatory watchers
      const mandatoryWatchersEmails = await Promise.all(
        [
          ...(data.people.authors || currentArticle.people.authors),
          ...(data.people.editors?.primary || currentArticle.people.editors?.primary),
        ].map(async (github_id) => {
          const profile = await mongoose.model<IUserDoc>('User').findOne({ github_id }); // get the profile, which may contain an email
          return profile.email;
        })
      );

      const email = (reason?: string) => {
        return `
            <h1 style="font-size: 20px;">
              The Paladin Network
            </h1>
            <p>
              The stage has been updated for an article you are watching on Cristata.
              <br />
              To view the article, go to <a href="https://thepaladin.cristata.app/cms/item/articles/${id}">https://thepaladin.cristata.app/cms/item/articles/${id}</a>
            </p>
            <p>
              <span>
                <b>Headline: </b>
                ${data.name || currentArticle.name}
              </span>
              <br />
              <span>
                <b>New Stage: </b>
                ${EnumArticleStage[data.stage]}
              </span>
              <br />
              <span>
                <b>Unique ID: </b>
                ${id}
              </span>
            </p>
            ${
              reason
                ? `
                  <p style="color: #888888">
                    You receievd this email because ${reason}.
                  </p>
                `
                : ''
            }
            <p style="color: #aaaaaa">
              Powered by Cristata
            </p>
          `;
      };

      // send email
      sendEmail(
        watchersEmails,
        `[Stage: ${EnumArticleStage[data.stage]}] ${data.name || currentArticle.name}`,
        email(`you clicked the 'Watch" button for this article in Cristata`)
      );
      sendEmail(
        mandatoryWatchersEmails,
        `[Stage: ${EnumArticleStage[data.stage]}] ${data.name || currentArticle.name}`,
        email(`you are an are an author or editor for this article`)
      );
    }
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Watch an article.
 *
 * @param id - the id of the article
 * @param user - the patching user's profile
 * @param watch - whether to watch the article
 * @param res - the response for an HTTP request
 */
async function watchArticle(id: string, user: IProfile, watch: boolean, res: Response = null): Promise<void> {
  // if the current document does not exist, do not continue
  const currentArticle = await getArticle(id, 'id', user);
  if (!currentArticle) {
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

  // get the current watchers, and then modify the array to either include or exclude the user based on whether they want to watch the article
  let watching = currentArticle.people.watching;
  if (watch) {
    watching = [...new Set([...currentArticle.people.watching, parseInt(user.id)])]; // adds the user to the array, and then removes duplicates
  } else {
    watching = currentArticle.people.watching.filter((github_id) => github_id !== parseInt(user.id));
  }

  // attempt to patch the article
  try {
    await Article.updateOne(filter, { $set: { 'people.watching': watching } });
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
    const isUploaded =
      currentArticle.stage === (EnumArticleStage['Uploaded/Scheduled'] || EnumArticleStage.Published);
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

/**
 * Get the number of articles in the different stages.
 *
 * @param res - the response for an HTTP request
 */
async function getStageCounts(res = null): Promise<void> {
  try {
    const articleStageCounts = await Article.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]);
    res ? res.json(articleStageCounts) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export {
  newArticle,
  getArticles,
  getPublicArticles,
  getPublicArticle,
  getArticle,
  patchArticle,
  watchArticle,
  deleteArticle,
  getStageCounts,
};
