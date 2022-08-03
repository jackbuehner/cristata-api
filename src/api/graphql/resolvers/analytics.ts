import { ForbiddenError } from 'apollo-server-errors';
import crypto from 'crypto';
import { Context } from '../server';
import { requireAuthentication } from '../helpers';

const analytics = {
  Query: {
    fathomDashboard: async (_: never, __: never, context: Context): Promise<string> => {
      requireAuthentication(context);
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const password = crypto
        .createHash('sha256')
        .update(context.config.secrets.fathom.dashboardPassword)
        .digest('hex'); // hash the password
      return `https://app.usefathom.com/share/${context.config.secrets.fathom.siteId}/wordpress?password=${password}`;
    },
  },
};

export { analytics };
