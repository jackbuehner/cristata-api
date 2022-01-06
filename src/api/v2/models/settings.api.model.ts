import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Response } from 'express';
import { ISettings, ISettingsDoc } from '../../../mongodb/settings.model';
import { IDeserializedUser } from '../../../passport';
import { Teams } from '../../../config/database';

// load environmental variables
dotenv.config();
const adminTeamID = Teams.ADMIN;

// define model
const Settings = mongoose.model<ISettingsDoc>('Settings');

/**
 * Post a new setting.
 *
 * @param data data permitted/required by the schema
 * @param user - the getting user's profile
 */
async function newSetting(data: ISettings, user: IDeserializedUser, res: Response = null): Promise<void> {
  try {
    if (user.teams.includes(adminTeamID)) {
      const settings = new Settings({ ...data });
      await settings.save();
      res ? res.json(settings) : null;
    }
    res ? res.status(403).send() : null;
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get a setting by id or name.
 *
 * @param id - the id or name of the setting
 * @param by - _name_ or _id_ (default: _id_)
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getSetting(
  id: string,
  by: string,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  // if by is name, use 'name' as method; otherwise, use '_id' as method
  const method = by === 'name' ? 'name' : '_id';

  // get the setting
  try {
    if (user.teams.includes(adminTeamID)) {
      const settings = await Settings.findOne({ [method]: id });
      res
        ? settings
          ? res.json(settings)
          : res.status(404).json({ message: 'document does not exist' })
        : null;
    }
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Get all settings.
 *
 * @param user - the getting user's profile
 * @param res - the response for an HTTP request
 */
async function getSettings(user: IDeserializedUser, res: Response = null): Promise<void> {
  try {
    if (user.teams.includes(adminTeamID)) {
      const settings = await Settings.find({});
      res ? (settings ? res.json(settings) : res.status(400).end()) : null;
    }
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Patch a setting.
 *
 * @param id - the id of the setting
 * @param data - the data permitted by the schema that will be changed
 * @param user - the patching user's profile
 * @param res - the response for an HTTP request
 */
async function patchSetting(
  id: string,
  data: ISettings,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  try {
    if (user.teams.includes(adminTeamID)) {
      await Settings.updateOne({ _id: id }, { $set: data });
      res ? res.status(200).send() : null;
    }
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

/**
 * Delete a setting.
 *
 * @param id - the id of the setting
 * @param user - the deleting user's profile
 * @param res - the response for an HTTP request
 */
async function deleteSetting(id: string, user: IDeserializedUser, res = null): Promise<void> {
  try {
    if (user.teams.includes(adminTeamID)) {
      await Settings.deleteOne({ _id: id });
      res ? res.status(204).send() : null;
    }
  } catch (error) {
    console.error(error);
    res ? res.status(400).json(error) : null;
  }
}

export { newSetting, getSetting, getSettings, patchSetting, deleteSetting };
