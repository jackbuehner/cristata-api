import { AuthenticationError } from 'apollo-server-errors';
import { IDeserializedUser } from '../../app/passport';
import { Context } from '../server';

function requireAuthentication(
  context: Context
): context is Omit<Context, 'profile'> & { profile: IDeserializedUser } {
  if (!context.isAuthenticated) throw new AuthenticationError('you must be logged in');
  if (!context.profile) throw new AuthenticationError('your account could not be found');
  return true;
}

export { requireAuthentication };
