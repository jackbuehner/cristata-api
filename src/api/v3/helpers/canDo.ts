import { Context } from '../../../apollo';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';
import { CollectionPermissionsActions } from '../../../config/database';
import { requireAuthentication } from '.';
import { get as getProperty } from 'object-path';
import mongoose from 'mongoose';
import { isObjectId } from '../../../utils/isObjectId';
import { isArray } from '../../../utils/isArray';
import { merge } from 'merge-anything';

interface CanDo {
  model: string;
  action: CollectionPermissionsActions;
  context: Context;
  doc?: DocType;
}

async function canDo({ model, action, context, doc }: CanDo): Promise<boolean> {
  requireAuthentication(context);

  // get the permsissions for the collection
  const permissions = context.config.database.collections.find(
    (collection) => collection.name === model
  ).actionAccess;
  const tp = permissions[action]?.teams;
  const up = permissions[action]?.users;

  // if the user has any `next_step` (aka the account is not fully set up), deny permission
  if (context.profile.next_step) return false;

  // if a team in the action is 0, any person has access
  if (tp?.includes(0)) return true;

  // treat strings in the users array as document values (e.g. 'people.authors' represents the authors for the defined doc)
  if (doc && up) {
    const leanDoc = (doc as unknown as mongoose.Document).toObject?.() || doc;

    // get the ids from the provided values
    const _ids: mongoose.Types.ObjectId[] = merge(
      [],
      ...up
        .filter((item): item is string => typeof item === 'string')
        .map((path) => {
          const pathValue = getProperty(leanDoc, path);
          if (isArray(pathValue)) return pathValue.filter((val) => isObjectId(val));
          else if (isObjectId(pathValue)) return [pathValue];
          else return [];
        })
    );

    // return true if current user is in any of the found ids
    if (_ids.map((_id) => _id.toHexString()).includes(context.profile._id.toHexString())) return true;
  }

  // if an approved team for the action is also in the current user's teams
  if (tp) {
    // identify the teams in the collection permissions object
    const teamIds = [
      // identify hex representations of object ids
      ...tp
        .filter((team) => isObjectId(team))
        .filter((team): team is string => team !== 0)
        .map((team) => new mongoose.Types.ObjectId(team)),
      // treat other strings in the teams array as team names
      // (e.g. 'admin' represents the _id of the team named 'admin')
      ...(await Promise.all(
        tp
          .filter((team) => typeof team === 'string' && !isObjectId(team))
          .map(async (slug) => {
            const foundTeam = await mongoose.model('team').findOne({ slug });
            const teamId: mongoose.Types.ObjectId | null = foundTeam?._id || null;
            return teamId;
          })
          .filter((teamId) => !!teamId)
      )),
    ];

    // if the collection permissions includes one of the current user's teams
    teamIds?.some((teamId) => context.profile.teams.includes(teamId.toHexString()));
  }

  // if the collection permissons action includes any user
  if (
    up
      ?.filter((item): item is mongoose.Types.ObjectId => isObjectId(item))
      .map((_id) => _id.toHexString())
      .includes('000000000000000000000000')
  )
    return true;

  // if the collection permissions action includes the current user
  if (
    up
      ?.filter((item): item is mongoose.Types.ObjectId => isObjectId(item))
      .map((_id) => _id.toHexString())
      .includes(context.profile._id.toHexString())
  )
    return true;

  return false;
}

type DocType = CollectionSchemaFields &
  PublishableCollectionSchemaFields &
  WithPermissionsCollectionSchemaFields;

export { canDo };
