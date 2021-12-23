import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { EnumSatireStage, ISatire, ISatireDoc } from '../../../mongodb/satire.model';
import { IProfile } from '../../../passport';
import { slugify } from '../../../utils/slugify';
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
const Satire = mongoose.model<ISatireDoc>('Satire');

/**
 * Post a new satire.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newSatire(data: ISatire, user: IProfile, res: Response = null): Promise<void> {
  const satire = new Satire({
    // set people data based on who created the document
    permissions: {
      users: [user._id],
      teams: [Groups.COPY_EDITOR, Groups.MANAGING_EDITOR],
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
    await satire.save();
    res ? res.json(satire) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all of the satire in the satire collection.
 *
 * @param user - the getting user's profile
 */
async function getSatires(user: IProfile, query: URLSearchParams, res: Response = null): Promise<void> {
  // expose history type to the filter
  const historyType = query.getAll('historyType');

  // admin: full access
  // others: only get documents for which the user has access (by team or userID)
  const filter: Record<string, unknown> = user.teams.includes(adminTeamID)
    ? {}
    : { $or: [{ 'permissions.teams': { $in: user.teams } }, { 'permissions.users': user.id }] };
  if (historyType.length > 0) {
    filter.history = { $elemMatch: { type: { $in: historyType } } };
  }

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
    ...replaceObjectIdWithUserObj(
      Object.keys((Satire.schema.obj.people as { type: { obj: ISatireDoc['people'] } }).type.obj)
        .filter((key) => !key.includes('display_authors'))
        .map((key) => `people.${key}`),
      'Satire'
    ),
  ];

  // attempt to get all satire
  try {
    const satires = await Satire.aggregate(pipeline);
    res ? res.json(satires) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

const publicUnset = [
  'stage',
  'locked',
  'hidden',
  'satire_id',
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
  'photoObj',
];

/**
 * Get all of the published satire in the satire collection.
 */
async function getPublicSatires(query: URLSearchParams, res: Response = null): Promise<void> {
  // expose queries
  const authors = query.getAll('author').map((author) => parseInt(author)); // convert each string to an integer
  const page = parseInt(query.get('page')) || 1;
  const limit = parseInt(query.get('limit')) || 10;

  try {
    const satire = Satire.aggregate([
      {
        $match: { stage: 5.2 },
      },
      {
        $match: authors.length > 0 ? { 'people.authors': { $in: authors } } : {},
      },
      {
        $match: { 'timestamps.published_at': { $lt: new Date() } },
      },
      { $sort: { 'timestamps.published_at': -1 } },
      {
        $unset: publicUnset,
      },
    ]);

    // @ts-expect-error aggregatePaginate DOES exist. The types for the plugin have not been updated for newer versions of mongoose.
    const paginatedSatires = await Satire.aggregatePaginate(satire, { page, limit });

    res ? res.json(paginatedSatires) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all a published satire from the satire collection.
 */
async function getPublicSatire(slug: string, res: Response = null): Promise<void> {
  try {
    const satire = await Satire.aggregate([
      {
        $match: { slug: slug, stage: 5.2 },
      },
      {
        $match: { 'timestamps.published_at': { $lt: new Date() } },
      },
      { $sort: { 'timestamps.published_at': -1 } },
      { $limit: 1 },
      {
        $unset: publicUnset,
      },
    ]);
    res ? (satire ? res.json(satire[0]) : res.status(404).end()) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a satire by id or name.
 *
 * @param id - the id or name of the satire
 * @param by - _name_ or _id_ (default: _id_)
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getSatire(id: string, by: string, user: IProfile, res: Response = null): Promise<ISatireDoc> {
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
    ...replaceObjectIdWithUserObj(
      Object.keys((Satire.schema.obj.people as { type: { obj: ISatireDoc['people'] } }).type.obj)
        .filter((key) => !key.includes('display_authors'))
        .map((key) => `people.${key}`),
      'Satire'
    ),
  ];

  // get the satire
  try {
    const satires = await Satire.aggregate(pipeline);
    if (res) satires?.length > 0 ? res.json(satires[0]) : res.status(404).json({ message: noMatchMessage });
    return await Satire.findOne(filter);
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a satire.
 *
 * @param id - the id of the satire
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param canPublish - whether the user has publish permissions
 * @param res - the response for an HTTP request
 */
async function patchSatire(
  id: string,
  data: ISatire,
  user: IProfile,
  canPublish = false,
  res: Response = null
): Promise<void> {
  // if the current document does not exist, do not continue (use POST to create an document)
  const currentSatire = (await getSatire(id, 'id', user)).toObject();
  if (!currentSatire) {
    const err =
      'the existing document does not exist or you do not have access. If you are trying to create a document, use the POST method';
    res.status(404).json({ message: err });
    console.error(err);
    return;
  }

  // if the satire's current state is uploaded or published, do not patch satire unless user canPublish
  const isUploaded = currentSatire.stage === (EnumSatireStage.UPLOADED || EnumSatireStage.PUBLISHED);
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
    : data.stage === EnumSatireStage.PUBLISHED
    ? 'published'
    : data.stage === EnumSatireStage.UPLOADED
    ? 'uploaded'
    : 'patched';

  // set modified_at, modified_by, and last_modified_by
  data = {
    ...data,
    people: {
      ...currentSatire.people,
      ...data.people,
      modified_by: [...new Set([...currentSatire.people.modified_by, user._id])], // adds the user to the array, and then removes duplicates
      last_modified_by: user._id,
    },
    timestamps: {
      ...currentSatire.timestamps,
      ...data.timestamps,
      modified_at: new Date().toISOString(),
    },
    // set history data
    history: currentSatire.history
      ? [...currentSatire.history, { type: historyType, user: user._id, at: new Date().toISOString() }]
      : [{ type: historyType, user: user._id, at: new Date().toISOString() }],
    permissions: {
      ...currentSatire.permissions,
      ...data.permissions,
    },
  };

  // update the publish time if the document is being published for the first time
  if (data.stage === EnumSatireStage.PUBLISHED) {
    if (!currentSatire.timestamps?.published_at && !data.timestamps?.published_at) {
      // if the client did not provide a publish time and the article was not already published
      data.timestamps.published_at = new Date().toISOString();
    }
  }

  // set the slug if the document is being published and does not already have one
  if (data.stage === EnumSatireStage.PUBLISHED && (!data.slug || !currentSatire.slug)) {
    data.slug = slugify(data.name || currentSatire.name);
  }

  // attempt to patch the satire
  try {
    await Satire.updateOne(filter, { $set: data });
    res ? res.status(200).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a satire.
 *
 * @param id - the id of the satire
 * @param user - the deleting user's profile
 * @param canPublish - whether the user has publish permissions
 * @param res - the response for an HTTP request
 */
async function deleteSatire(id: string, user: IProfile, canPublish = false, res = null): Promise<void> {
  // if the satire's current state is uploaded or published, do not patch satire unless user canPublish
  const currentSatire = (await getSatire(id, 'id', user)).toObject();
  if (currentSatire) {
    const isUploaded = currentSatire.stage === (EnumSatireStage.UPLOADED || EnumSatireStage.PUBLISHED);
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

  // atempt to delete satire
  try {
    await Satire.deleteOne(filter);
    res ? res.status(204).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get the number of satire in the different stages.
 *
 * @param res - the response for an HTTP request
 */
async function getStageCounts(res = null): Promise<void> {
  try {
    // @ts-expect-error _id should be a string with reference to another variable
    const satireStageCounts = await Satire.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]);
    res ? res.json(satireStageCounts) : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export {
  newSatire,
  getSatires,
  getPublicSatires,
  getPublicSatire,
  getSatire,
  patchSatire,
  deleteSatire,
  getStageCounts,
};
