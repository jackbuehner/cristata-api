import dotenv from 'dotenv';
import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import Cristata from '../../Cristata';
import { TenantDB } from '../../mongodb/TenantDB';
import { magicLogin } from '../middleware/magicLogin';
import { requireAuth } from '../middleware/requireAuth';
import { deserializeUser, IDeserializedUser } from '../passport';

// load environmental variables
dotenv.config();

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
  console.error(error);
  cristata.logtail.error(JSON.stringify(error));
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
    passport.authenticate(`local-${tenant}`, (err: Error | null, user, authErr: Error) => {
      // handle error
      if (err) handleError(err, req, res, cristata, true);
      // handle authentication error
      else if (authErr) {
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
      }
      // don't sign in if user is missing after authentication
      else if (!user) {
        if (req.body.redirect === false) res.json({ error: 'user is missing' });
        else
          res.redirect(
            req.body.server
              ? req.baseUrl + '/local'
              : process.env.AUTH_APP_URL + '/' + (req.user as IDeserializedUser).tenant
          );
      } else {
        // sign in
        req.logIn(user, (err) => {
          if (err) handleError(err, req, res, cristata);
          else if (req.body.redirect === false) {
            deserializeUser({
              _id: user._id,
              provider: user.provider,
              next_step: user.next_step,
              tenant: user.tenant,
            }).then((result) => {
              // error message
              if (typeof result === 'string') res.status(401).json({ error: result });
              // user object
              else res.json({ data: result });
            });
          } else res.redirect(process.env.AUTH_APP_URL + '/' + (req.user as IDeserializedUser).tenant);
        });
      }
    })(req, res, next);
  });

  // add the passport-magic-login strategy to Passport
  passport.use(magicLogin);

  // authenticate using a magic link
  router.post('/magiclogin', magicLogin.send);
  router.get('/magiclogin/callback', (req, res, next) => {
    passport.authenticate(
      'magiclogin',
      (
        err: Error | null,
        user:
          | {
              _id: string;
              provider: string;
              next_step?: string | undefined;
              tenant: string;
            }
          | undefined
      ) => {
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
        req.logIn(user, (err) => {
          if (err) {
            handleError(err, req, res, cristata);
            return;
          }

          if ((req.query as unknown as URLSearchParams).get('redirect') === 'false') {
            deserializeUser(user).then((result) => {
              // error message
              if (typeof result === 'string') res.status(401).json({ error: result });
              // user object
              else res.json({ data: result });
            });
          } else res.redirect(process.env.AUTH_APP_URL + '/' + user.tenant);
        });
      }
    )(req, res, next);
  });

  return router;
}

export { factory as authRouterFactory };
