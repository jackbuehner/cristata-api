import { AuthenticationError } from 'apollo-server-errors';
import { useApolloContext, useMongoose } from '../../../tests/hooks';
import { requireAuthentication } from './requireAuthentication';

describe(`api >> v3 >> helpers >> requireAuthentication`, () => {
  useMongoose();

  const c: Parameters<typeof useApolloContext>[0] = {
    isAuthenticated: true,
    collection: {
      name: 'Foo',
      withPermissions: true,
      actionAccess: {
        get: { users: [0], teams: [0] },
        create: { users: [0], teams: [0] },
        modify: { users: [0], teams: [0] },
        hide: { users: [0], teams: [0] },
        lock: { users: [0], teams: [0] },
        archive: { users: [0], teams: [0] },
        watch: { users: [0], teams: [0] },
        delete: { users: [0], teams: [0] },
      },
    },
  };

  it('should continue if the request is authenticated by a user', async () => {
    c.isAuthenticated = true;
    const context = useApolloContext(c);

    requireAuthentication(context);
  });

  it('should throw an error when there is no authenticated user', async () => {
    c.isAuthenticated = false;
    const context = useApolloContext(c);

    const expectedError = new AuthenticationError('you must be logged in');
    expect(() => requireAuthentication(context)).toThrow(expectedError);
  });

  it('should throw an error when the user is authenticated by their profile cannot be found', async () => {
    c.isAuthenticated = true;
    const context = useApolloContext(c);
    context.profile = undefined;

    const expectedError = new AuthenticationError('your account could not be found');
    expect(() => requireAuthentication(context)).toThrow(expectedError);
  });
});
