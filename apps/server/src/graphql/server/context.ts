import { ContextFunction } from 'apollo-server-core';
import { ExpressContext } from 'apollo-server-express';
import mongoose from 'mongoose';
import Cristata from '../../Cristata';
import { IDeserializedUser } from '../../app/passport';
import { Configuration } from '../../types/config';

interface Input extends ExpressContext {
  __cristata: {
    tenant: string;
    cristata: Cristata;
  };
}

/**
 * Returns a context object containing authentication information.
 */
const context: ContextFunction<Input, Context> = ({ req, __cristata }) => {
  const { tenant, cristata } = __cristata;
  const config = cristata.config[tenant];
  const restartApollo = () => cristata.restartApollo(tenant);
  const serverOrigin = `${req.protocol}://${req.get('host')}`;

  // inject tenant and profile into logs
  cristata.logtail.use(async (log) => {
    return {
      ...log,
      tenant,
      user: JSON.parse(JSON.stringify(req.user || 'none')),
    };
  });

  if (req.headers.authorization) {
    const [type, token] = req.headers.authorization.split(' ');
    if (type === 'app-token') {
      const matchedToken = config.tokens?.find(({ token: appToken }) => appToken === token);
      if (matchedToken) {
        const isAuthenticated = !!matchedToken;
        const profile: IDeserializedUser = {
          _id: new mongoose.Types.ObjectId('000000000000000000000000'),
          email: 'token@cristata.app',
          methods: ['local'],
          name: 'TOKEN_' + matchedToken.name,
          next_step: '',
          provider: 'local',
          teams: matchedToken.scope.admin === true ? ['000000000000000000000001'] : [],
          tenant: tenant,
          two_factor_authentication: false,
          username: 'TOKEN_' + matchedToken.name,
        };
        return { config, isAuthenticated, profile, tenant, cristata, restartApollo, serverOrigin };
      }
    }
  }

  const isAuthenticated = req.isAuthenticated() && (req.user as IDeserializedUser).tenant === tenant;
  const profile = req.user as IDeserializedUser | undefined;
  return { config, isAuthenticated, profile, tenant, cristata, restartApollo, serverOrigin };
};

interface Context {
  config: Configuration;
  isAuthenticated: boolean;
  profile?: IDeserializedUser;
  tenant: string;
  cristata: Cristata;
  restartApollo: () => Promise<Error | void>;
  serverOrigin: string;
}

export type { Context };
export { context };
