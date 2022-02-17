import { Context } from '../../../apollo';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';
import { CollectionPermissionsActions, Teams, Users } from '../../../config/database';
import { requireAuthentication } from '.';

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
    .actionAccess(Users, Teams, context, doc);

  // if the user has any `next_step` (aka the account is not fully set up), deny permission
  if (context.profile.next_step) return false;

  // return whether the action can be done
  return (
    permissions[action]?.teams.includes(Teams.ANY) ||
    permissions[action]?.users.includes(Users.ANY) ||
    permissions[action]?.teams.some((team) => context.profile.teams.includes(team)) ||
    permissions[action]?.users.includes(context.profile._id)
  );
}

type DocType = CollectionSchemaFields &
  PublishableCollectionSchemaFields &
  WithPermissionsCollectionSchemaFields &
  Record<string, unknown>;

export { canDo };
