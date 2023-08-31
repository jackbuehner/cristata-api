import { hasKey, isObjectId } from '@jackbuehner/cristata-utils';
import { ContextFunction } from 'apollo-server-core';
import { ExpressContext } from 'apollo-server-express';
import mongoose from 'mongoose';
import Cristata from '../../Cristata';
import { IDeserializedUser } from '../../app/passport';
import { TenantDB } from '../../mongodb/TenantDB';
import { IUser } from '../../mongodb/users';
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
const context: ContextFunction<Input, Context> = async ({ req, __cristata }): Promise<Context> => {
  const { tenant, cristata } = __cristata;
  const config = cristata.config[tenant];
  const restartApollo = () => cristata.restartApollo(tenant);
  const testNewConfig = (config: Configuration) => cristata.testNewConfig(tenant, config);
  const serverOrigin = `${req.protocol}://${req.get('host')}`;

  if (req.headers.authorization) {
    const [type, token] = req.headers.authorization.split(' ');
    if (type === 'app-token') {
      const matchedToken = Object.entries(config.tokens || [])
        .map(([key, val]) => ({ _id: key, ...val }))
        .find(({ token: appToken }) => appToken === token);
      if (matchedToken) {
        const expired = new Date(matchedToken.expires) < new Date();
        const noScope = Object.entries(matchedToken.scope).filter(([, val]) => !!val).length === 0;
        const disabled = expired || noScope;

        if (!disabled) {
          const isAuthenticated = !!matchedToken;
          const profile: Context['profile'] = {
            _id: isObjectId(matchedToken.user_id)
              ? new mongoose.Types.ObjectId(matchedToken.user_id)
              : new mongoose.Types.ObjectId('000000000000000000000000'),
            email: 'token@cristata.app',
            methods: ['local'],
            name: 'TOKEN_' + matchedToken._id,
            teams: matchedToken.scope.admin === true ? ['000000000000000000000001'] : [],
            tenant: tenant,
            username: 'TOKEN_' + matchedToken._id,
          };
          return {
            config,
            isAuthenticated,
            profile,
            tenant,
            cristata,
            restartApollo,
            testNewConfig,
            serverOrigin,
          };
        }
      }
    }
  }

  const isAuthenticated = req.isAuthenticated() && (req.user as IDeserializedUser).tenant === tenant;

  const profile: Context['profile'] = await (async () => {
    if (!req.user) return;
    if (!hasKey('_id', req.user)) return;

    // connect to the database
    const tenantDB = new TenantDB(tenant);
    await tenantDB.connect();
    const Users = await tenantDB.model<IUser>('User');
    const Teams = await tenantDB.model('Team');

    // get the user document
    const doc = await Users?.findById(req.user._id);

    // handle if doc is undefined
    if (!doc) {
      const message = 'context: user doc is undefined';
      console.error(message);
      throw new Error(message);
    }

    // find the user's teams
    let teams = await Teams?.find({ $or: [{ organizers: req.user._id }, { members: req.user._id }] });

    // if teams is undefined or null, log error and set to empty array
    if (!teams) {
      console.error('teams was undefined or null');
      teams = [];
    }

    return {
      tenant,
      _id: doc._id as mongoose.Types.ObjectId,
      name: doc.name,
      username: doc.username,
      email: doc.email || `${doc.username}__noreply@${tenant}.cristata.app`,
      teams: teams.map((team) => team._id.toHexString()),
      methods: doc.methods || [],
    };
  })();

  return { config, isAuthenticated, profile, tenant, cristata, restartApollo, testNewConfig, serverOrigin };
};

interface Context {
  config: Configuration;
  isAuthenticated: boolean;
  profile?: {
    tenant: string;
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
    email: string;
    teams: string[];
    methods: string[];
  };
  tenant: string;
  cristata: Cristata;
  restartApollo: () => Promise<Error | void>;
  testNewConfig: (config: Configuration) => Promise<Error | void>;
  serverOrigin: string;
}

export { context };
export type { Context };
