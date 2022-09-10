import { MagicLoginStrategy } from 'passport-magic-login';
import { TenantDB } from '../../mongodb/TenantDB';
import { IUser } from '../../mongodb/users';
import { sendEmail } from '../../utils/sendEmail';
//@ts-expect-error the declarations for this refuse to work
import TokenExpiredError from 'jsonwebtoken/lib/TokenExpiredError';
//@ts-expect-error the declarations for this refuse to work
import NotBeforeError from 'jsonwebtoken/lib/NotBeforeError';

const magicLogin = new MagicLoginStrategy({
  // Used to encrypt the authentication token. Needs to be long, unique and (duh) secret.
  secret: process.env.MAGIC_LINK_SECRET || '',

  // The authentication callback URL
  callbackUrl: '/auth/magiclogin/callback', // remember to also update in the routes

  // Called with the generated magic link so you can send it to the user
  // "destination" is what you POST-ed from the client
  // "href" is your confirmUrl with the confirmation token,
  // for example "/auth/magiclogin/confirm?token=<longtoken>"
  sendMagicLink: async (username, href, verificationCode, req) => {
    // get then tenant
    const searchParams = req.query as unknown as URLSearchParams;
    const tenant = searchParams.get('tenant');
    if (!tenant) throw 'Tenant is missing from URL';

    // connect to the database
    const tenantDB = new TenantDB(tenant);
    await tenantDB.connect();
    const Users = await tenantDB.model<IUser>('User');

    // get the user document
    let doc = await Users?.findOne({ username: username });
    if (!doc) doc = await Users?.findOne({ slug: username });
    if (!doc) doc = await Users?.findOne({ email: username });
    if (!doc) throw 'The provided username or email does not exist';
    if (!doc.email) throw 'There is no email address connected to this account';

    // store the code so we can check that only this code is used during verification
    doc.last_magic_code = verificationCode;
    await doc.save();

    const token = new URL(`https://cristata.app/${href}`).searchParams.get('token') || '';

    const config = req.cristata.config[tenant];
    sendEmail(
      config,
      doc.email,
      `Your magic sign-in link`,
      `Click here to sign in: ${
        process.env.AUTH_APP_URL || ''
      }/${tenant}/sign-in/magic-link/use?token=${encodeURIComponent(token)}&return=${req.body.returnUrl}`
    );
  },

  // Once the user clicks on the magic link and verifies their login attempt,
  // you have to match their email to a user record in the database.
  // If it doesn't exist yet they are trying to sign up so you have to create a new one.
  // "payload" contains { "destination": "email or username" }
  // In standard passport fashion, call callback with the error as the first argument (if there was one)
  // and the user data as the second argument!
  verify: async (error, payload, done, req) => {
    if (error) {
      if (error.name === 'TokenExpiredError')
        done(new TokenExpiredError('This magic link has expired', error.date));
      else if (error.name === 'NotBeforeError')
        done(
          new NotBeforeError(
            `This magic link will not be active until ${error.date?.toISOString()}`,
            error.date
          )
        );
      else done(error);
      return;
    }

    if (!payload) {
      done(new Error('Magic token payload is empty'));
      return;
    }

    // get then tenant
    const searchParams = req.query as unknown as URLSearchParams;
    const tenant = searchParams.get('tenant');
    if (!tenant) {
      done(new Error('Tenant is missing from URL'));
      return;
    }

    // connect to the database
    const tenantDB = new TenantDB(tenant);
    await tenantDB.connect();
    const Users = await tenantDB.model<IUser>('User');

    // get the user document
    let doc = await Users?.findOne({ username: payload.destination });
    if (!doc) doc = await Users?.findOne({ slug: payload.destination });
    if (!doc) doc = await Users?.findOne({ email: payload.destination });

    // handle if doc is undefined
    if (!doc) {
      done(new Error('User could not be found'));
      return;
    }

    // check that the magic link is valid
    if (doc.last_magic_code !== payload.code) {
      done(new Error('This magic link is invalid or has already been used'));
      return;
    }

    // remove this magic code since it has been successfully used
    doc.last_magic_code = '';
    await doc.save();

    // authenticate the user
    done(undefined, {
      _id: doc._id,
      provider: 'magiclink',
      next_step: '',
      tenant: tenant,
    });
  },
});

export { magicLogin };
