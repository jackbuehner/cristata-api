import { hasKey, isObjectId, replaceCircular } from '@jackbuehner/cristata-utils';
import dotenv from 'dotenv';
import { NextFunction, Request, Response, Router } from 'express';
import { isPlainObject } from 'is-what';
import passport from 'passport';
import Cristata from '../../Cristata';
import { TenantDB } from '../../mongodb/TenantDB';
import { magicLogin } from '../middleware/magicLogin';
import { requireAuth } from '../middleware/requireAuth';
import { deserializeUser, IDeserializedUser, UserToSerialize } from '../passport';
import mongoose from 'mongoose';

// load environmental variables
dotenv.config({ override: true });

/**
 * Handle authentication errors.
 *
 * @param error the error
 * @param req the request object (from express)
 * @param res the response object (from express)
 * @param descriptive whether the `error.message` should be sent to the client in JSON format; otherwise, redirect to error page
 * @param code error code to use when `descriptive === true` (defaults to 500)
 */
const handleError = (
  error: Error,
  req: Request,
  res: Response,
  cristata: Cristata,
  descriptive = false,
  code = 500
) => {
  // skipping logging errors from incorrect credentioals
  if (code !== 401) {
    console.error(error);
    cristata.logtail.error(JSON.stringify(replaceCircular(error)));
  }
  if (descriptive) res.status(code).json({ error: error.message });
  else if (req.body.redirect === false) res.status(500).json({ error: 'error authenticating' });
  else res.redirect(req.baseUrl + '/error');
};

/**
 * Router for app authentication.
 */
function factory(cristata: Cristata): Router {
  const router = Router();

  // provide the authenticated user
  router.get('/', requireAuth, (req: Request, res: Response) => {
    res.json(req.user);
  });

  // send an error message
  router.get('/error', (req: Request, res: Response) => res.send('Unknown Error'));

  // clear credentials from the client (sign out)
  router.get('/clear', (req: Request, res: Response) => {
    req.session = null;
    req.logout();
    res.redirect('./');
  });
  router.post('/clear', (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      req.session = null;
      req.logout();
      res.status(200).send();
    } else {
      res.status(404).send();
    }
  });

  // authenticate using the local strategy
  router.post('/local', async (req: Request, res: Response, next: NextFunction) => {
    // get then tenant so we know which local strategy to use
    const searchParams = req.query as unknown as URLSearchParams;
    const tenant = searchParams.get('tenant');
    if (!tenant) {
      res.status(404).end();
      return;
    }

    // create the user model in case it does not exist,
    // which also will cause the auth strategy to be created
    const tenantDB = new TenantDB(tenant, cristata.config[tenant].collections);
    await tenantDB.connect();
    await tenantDB.model('User');

    // use the local strategy for the provided tenant
    passport.authenticate(`local-${tenant}`, (err: Error | null, user: never, authErr: Error) => {
      if (err) {
        handleError(err, req, res, cristata, true);
        return;
      }

      if (authErr) {
        // map error names to status codes
        const code = (name: string) => {
          if (name === 'IncorrectPasswordError') return 401;
          if (name === 'IncorrectUsernameError') return 401;
          if (name === 'NoSaltValueStored') return 500;
          if (name === 'AttemptTooSoonError') return 429;
          if (name === 'TooManyAttemptsError') return 429;
          return 500;
        };
        handleError(authErr, req, res, cristata, true, code(authErr.name));
        return;
      }

      // don't sign in if user is missing after authentication
      if (!user) {
        if (req.body.redirect === false) res.json({ error: 'user is missing' });
        else
          res.redirect(
            req.body.server
              ? req.baseUrl + '/local'
              : process.env.AUTH_APP_URL + '/' + (req.user as IDeserializedUser).tenant
          );
        return;
      }

      // sign in
      const userToLogIn = prepareUser(user);
      req.logIn(userToLogIn, (err) => {
        if (err) {
          handleError(err, req, res, cristata);
          return;
        }

        if (req.body.redirect === false) {
          deserializeUser(userToLogIn).then((result) => {
            // error message
            if (typeof result === 'string') res.status(401).json({ error: result });
            // user object
            else res.json({ data: result });
          });
        } else res.redirect(process.env.AUTH_APP_URL + '/' + userToLogIn.tenant);
      });
    })(req, res, next);
  });

  // add the passport-magic-login strategy to Passport
  passport.use(magicLogin);

  // authenticate using a magic link
  router.post('/magiclogin', magicLogin.send);
  router.get('/magiclogin/callback', (req, res, next) => {
    passport.authenticate('magiclogin', (err: Error | null, user: never) => {
      if (err) {
        handleError(err, req, res, cristata, true);
        return;
      }

      if (!user) {
        if ((req.query as unknown as URLSearchParams).get('redirect') === 'false')
          res.json({ error: 'user is missing' });
        else res.redirect(req.body.server ? req.baseUrl + '/magiclogin' : process.env.AUTH_APP_URL || '');
        return;
      }

      // sign in
      const userToLogIn = prepareUser(user);
      req.logIn(userToLogIn, (err) => {
        if (err) {
          handleError(err, req, res, cristata);
          return;
        }

        if ((req.query as unknown as URLSearchParams).get('redirect') === 'false') {
          deserializeUser(userToLogIn).then((result) => {
            // error message
            if (typeof result === 'string') res.status(401).json({ error: result });
            // user object
            else res.json({ data: result });
          });
        } else res.redirect(process.env.AUTH_APP_URL + '/' + userToLogIn.tenant);
      });
    })(req, res, next);
  });

  return router;
}

/**
 * Takes an input user object and prepares if for serialization
 */
function prepareUser(user: unknown): UserToSerialize {
  if (isPlainObject(user)) {
    return {
      _id: (() => {
        if (hasKey('_id', user) && isObjectId(user._id)) {
          return new mongoose.Types.ObjectId(user._id as string);
        }
        throw new Error('_id must be a valid Object Id');
      })(),
      tenant: (() => {
        if (hasKey('tenant', user) && typeof user.tenant === 'string') {
          return user.tenant;
        }
        throw new Error('tenant must be a string');
      })(),
      provider: (() => {
        if (hasKey('provider', user) && typeof user.provider === 'string') {
          return user.provider;
        }
        throw new Error('provider must be a string');
      })(),
      name: (() => {
        if (hasKey('name', user) && typeof user.name === 'string') {
          return user.name;
        }
      })(),
      next_step: (() => {
        if (hasKey('next_step', user) && typeof user.next_step === 'string') {
          return user.next_step;
        }
      })(),
      errors: (() => {
        if (
          hasKey('errors', user) &&
          Array.isArray(user.errors) &&
          user.errors.every(
            (errorArr): errorArr is [string, string] =>
              Array.isArray(errorArr) &&
              errorArr.length === 2 &&
              typeof errorArr[0] === 'string' &&
              typeof errorArr[1] === 'string'
          )
        ) {
          return user.errors;
        }
      })(),
    };
  } else {
    throw new Error('user must be a object');
  }
}

export { factory as authRouterFactory };
