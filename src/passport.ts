import dotenv from 'dotenv';
import mongoose from 'mongoose';
import passport from 'passport';
import { IUserDoc } from './mongodb/users';
import { getPasswordStatus } from './utils/getPasswordStatus';
import { isArray } from './utils/isArray';

// load environmental variables
dotenv.config();

// passport stuff:
passport.serializeUser((user: Record<string, unknown>, done) => {
  if (user.errors && isArray(user.errors) && user.errors.length > 0)
    done(new Error(`${user.errors[0][0]}: ${user.errors[0][1]}`));
  else if (!user._id) done(new Error('User missing _id'));
  else if (!user.provider) done(new Error('User missing provider'));
  else done(null, { _id: user._id, provider: user.provider, next_step: user.next_step, tenant: user.tenant });
});

interface IDeserializedUser {
  tenant: string;
  provider: string;
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email: string;
  teams: string[];
  two_factor_authentication: boolean;
  next_step?: string;
  methods: string[];
  constantcontact?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

async function deserializeUser(
  user: { _id: string; provider: string; next_step?: string; tenant: string },
  done?: (err: Error | null, user?: false | null | Express.User) => void
): Promise<string | IDeserializedUser> {
  try {
    // handle missing _id
    if (!user._id) {
      const message = 'serialized user missing _id';
      console.error(message);
      done?.(new Error(message));
      return message;
    }

    // hanlde missing provider
    if (!user.provider) {
      const message = 'serialized user missing provider';
      console.error(message);
      done?.(new Error(message));
      return message;
    }

    // get the user document
    const tenantDB = mongoose.connection.useDb(user.tenant, { useCache: true });
    const doc = (await tenantDB.model('User').findById(user._id)) as IUserDoc;

    // handle if doc is undefined
    if (!doc) {
      const message = 'doc is undefined';
      console.error(message);
      done?.(new Error(message));
      return message;
    }

    // confirm that temporary account password is not expired
    const { temporary, expired } = getPasswordStatus(doc.flags);
    if (expired) {
      const message = 'password is expired';
      console.error(message);
      done?.(new Error(message));
      return message;
    }

    // ensure that account is not deactivated
    if (doc.retired) {
      const message = 'account is deactivated';
      console.error(message);
      done?.(new Error(message));
      return message;
    }

    // find the user's teams
    let teams = await tenantDB.model('Team').find({ $or: [{ organizers: user._id }, { members: user._id }] });

    // if teams is undefined or null, log error and set to empty array
    if (!teams) {
      console.error('teams was undefined or null');
      teams = [];
    }

    // return the user
    const du = {
      tenant: user.tenant,
      provider: user.provider,
      _id: new mongoose.Types.ObjectId(user._id),
      name: doc.name,
      username: doc.username,
      email: doc.email,
      teams: teams.map((team) => team._id.toHexString()),
      two_factor_authentication: false,
      next_step: user.next_step ? user.next_step : temporary ? 'change_password' : undefined,
      methods: doc.methods,
      constantcontact: doc.constantcontact,
    };
    done?.(null, du);
    return du;
  } catch (error) {
    console.error(error);
    done?.(error);
    return error.message;
  }
}
passport.deserializeUser(deserializeUser);

export { deserializeUser };
export type { IDeserializedUser };
