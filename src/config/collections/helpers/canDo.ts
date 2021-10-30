import { Context } from '../../../apollo';
import { CollectionPermissionsActions, Teams, Users } from '../../database';
import { requireAuthentication } from './';

interface CanDo {
  model: string;
  action: CollectionPermissionsActions;
  context: Context;
}

function canDo({ model, action, context }: CanDo): boolean {
  requireAuthentication(context);

  // get the permsissions for the collection
  const permissions = context.config.database.collections
    .find((collection) => collection.name === model)
    .permissions(Users, Teams);

  // return whether the action can be done
  return (
    permissions[action]?.teams.some((team) => context.profile.teams.includes(team)) ||
    permissions[action]?.users.includes(parseInt(context.profile.id))
  );
}

export { canDo };
