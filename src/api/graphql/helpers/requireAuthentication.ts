import { AuthenticationError } from 'apollo-server-errors';
import { Context } from '../server';

function requireAuthentication(context: Context): void {
  if (!context.isAuthenticated) throw new AuthenticationError('you must be logged in');
  if (!context.profile) throw new AuthenticationError('your account could not be found');
  return;
}

export { requireAuthentication };
