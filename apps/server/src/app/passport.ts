import dotenv from 'dotenv';
import mongoose from 'mongoose';
import passport from 'passport';
import { TenantDB } from '../mongodb/TenantDB';
import { IUser } from '../mongodb/users';
import { getPasswordStatus } from '@jackbuehner/cristata-utils';
import { isArray } from '@jackbuehner/cristata-utils';

// load environmental variables
dotenv.config({ override: true });

// passport stuff:
interface UserToSerialize extends Omit<IDeserializedUser, 'name'> {
  name?: string;
  errors?: [string, string][] | never;
}

//@ts-expect-error: we have our own user object
passport.serializeUser(({ errors, ...user }: UserToSerialize, done) => {
  if (errors && isArray(errors) && errors.length > 0) {
    done(new Error(`${errors[0]?.[0]}: ${errors[0][1]}`));
  } else if (!user._id) done(new Error('User missing _id'));
  else if (!user.provider) done(new Error('User missing provider'));
  else done(null, { _id: user._id, provider: user.provider, next_step: user.next_step, tenant: user.tenant });
});

interface IDeserializedUser {
  tenant: string;
  provider: string;
  _id: mongoose.Types.ObjectId;
  name: string;
  next_step?: string;
  otherUsers?: UserToSerialize[];
}

async function deserializeUser(
  user: { _id: string | mongoose.Types.ObjectId; provider: string; next_step?: string; tenant: string },
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

    // connect to the database
    const tenantDB = new TenantDB(user.tenant);
    await tenantDB.connect();
    const Users = await tenantDB.model<IUser>('User');
    const Teams = await tenantDB.model('Team');

    // get the user document
    const doc = await Users?.findById(user._id);

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
    let teams = await Teams?.find({ $or: [{ organizers: user._id }, { members: user._id }] });

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
      next_step: user.next_step ? user.next_step : temporary ? 'change_password' : undefined,
    };
    done?.(null, du);
    return du;
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      done?.(error);
      return error.message;
    }

    done?.(new Error('unknown error'));
    return 'unknown error';
  }
}
passport.deserializeUser(deserializeUser);

export { deserializeUser };
export type { IDeserializedUser, UserToSerialize };
