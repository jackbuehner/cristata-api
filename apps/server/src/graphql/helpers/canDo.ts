import { isArray, isObjectId } from '@jackbuehner/cristata-utils';
import { AuthenticationError } from 'apollo-server-core';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { get as getProperty } from 'object-path';
import { requireAuthentication } from '.';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/helpers/constructBasicSchemaFields';
import { TenantDB } from '../../mongodb/TenantDB';
import { CollectionPermissionsActions } from '../../types/config';
import { Context } from '../server';

interface CanDo {
  model: string;
  action: CollectionPermissionsActions;
  context: Context;
  doc?: DocType | null;
}

async function canDo({ model, action, context, doc }: CanDo): Promise<boolean> {
  if (!requireAuthentication(context)) throw new AuthenticationError('unknown');
  if (doc === null) return false;
  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  // get the permsissions for the collection
  const permissions = context.config.collections.find((collection) => collection.name === model)?.actionAccess;
  const tp = permissions?.[action]?.teams;
  const up = permissions?.[action]?.users;

  // if the user has any `next_step` (aka the account is not fully set up), deny permission
  if (context.profile.next_step) return false;

  // if a team in the action is 0, any person has access
  if (tp?.includes(0)) return true;

  // if the collection permissons action includes 0, any person has access
  if (up?.includes(0)) return true;

  // if the collection permissions action includes the current user
  if (up?.filter((item): item is string => isObjectId(item)).includes(context.profile._id.toHexString()))
    return true;

  // treat certain strings in the users array as document values (e.g. 'people.authors' represents the authors for the defined doc)
  if (doc && up) {
    const leanDoc = (doc as unknown as mongoose.Document).toObject?.() || doc;

    // get the ids from the provided values
    const _ids: mongoose.Types.ObjectId[] = merge(
      [],
      ...up
        // filter out object ids and 0
        .filter((item): item is string => typeof item === 'string' && !isObjectId(item))
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
      ...(
        await Promise.all(
          tp
            .filter((team) => typeof team === 'string' && !isObjectId(team))
            .map(async (slug) => {
              const Team = await tenantDB.model('Team');
              if (Team) {
                const foundTeam = await Team.findOne({ slug });
                const teamId: mongoose.Types.ObjectId | null = foundTeam?._id || null;
                return teamId;
              }
            })
        )
      ).filter((teamId): teamId is mongoose.Types.ObjectId => !!teamId),
    ];

    // return true if the collection permissions includes one of the current user's teams
    if (teamIds?.some((teamId) => context.profile.teams.includes(teamId.toHexString()))) return true;
  }

  return false;
}

type DocType = CollectionSchemaFields &
  PublishableCollectionSchemaFields &
  WithPermissionsCollectionSchemaFields;

export { canDo };
