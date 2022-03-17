import { Context } from '../../../apollo';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';
import { CollectionPermissionsActions, Teams, Users } from '../../../config/database';
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

function canDo({ model, action, context, doc }: CanDo): boolean {
  requireAuthentication(context);

  // get the permsissions for the collection
  const permissions = context.config.database.collections
    .find((collection) => collection.name === model)
    .actionAccess(context, doc);
  const tp = permissions[action]?.teams;
  const up = permissions[action]?.users;

  // if the user has any `next_step` (aka the account is not fully set up), deny permission
  if (context.profile.next_step) return false;

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

  // return whether the action can be done
  return (
    // the collection permissions specifies any team
    tp?.includes(Teams.ANY) ||
    // the collection permissions includes any user
    up
      ?.filter((item): item is mongoose.Types.ObjectId => isObjectId(item))
      .map((_id) => _id.toHexString())
      .includes(Users.ANY.toHexString()) ||
    // the collection permissions includes one of the current user's teams
    tp?.some((team) => context.profile.teams.includes(team)) ||
    // the collection permissions includes the current user's _id
    up
      ?.filter((item): item is mongoose.Types.ObjectId => isObjectId(item))
      .map((_id) => _id.toHexString())
      .includes(context.profile._id.toHexString())
  );
}

type DocType = CollectionSchemaFields &
  PublishableCollectionSchemaFields &
  WithPermissionsCollectionSchemaFields;

export { canDo };
