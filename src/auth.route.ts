import dotenv from 'dotenv';
import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import { deserializeUser } from './passport';
import { isArray } from './utils/isArray';

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
const handleError = (error: Error, req: Request, res: Response, descriptive = false, code = 500) => {
  console.error(error);
  if (descriptive) res.status(code).json({ error: error.message });
  if (req.body.redirect === false) res.status(500).json({ error: 'error authenticating' });
  else res.redirect(req.baseUrl + '/error');
};

/**
 * Router for app authentication.
 */
const router = Router();

// provide the authenticated user
router.get('/', (req: Request, res: Response) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(403).end();
  }
});

// send an error message
router.get('/error', (req: Request, res: Response) => res.send('Unknown Error'));

// clear credentials from the client (sign out)
router.get('/clear', (req: Request, res: Response) => {
  req.session = null;
  req.logout();
  const location = `${process.env.BASE_DOMAIN_PROTOCOL}://${process.env.BASE_DOMAIN}/sign-in`;
  res.redirect(location);
});

// redirect client to github for authentication
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user', 'read:org', 'write:org', 'read:discussion'] })
);

// listen for github auth response
router.get('/github/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('github', (err, user) => {
    if (user.errors && isArray(user.errors) && user.errors.length > 0)
      handleError(new Error(`${user.errors[0][0]}: ${user.errors[0][1]}`), req, res, true);
    if (err) handleError(err, req, res);
    if (!user) res.redirect(process.env.PASSPORT_REDIRECT);
    req.logIn(user, (err) => {
      if (err) handleError(err, req, res);
      res.redirect(process.env.PASSPORT_REDIRECT);
    });
  })(req, res, next);
});

// authenticate using the local strategy
router.post('/local', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: Error | null, user, authErr: Error) => {
    // handle error
    if (err) handleError(err, req, res, true);
    // handle authentication error
    else if (authErr) {
      // map error names to status codes
      const code = {
        IncorrectPasswordError: 401,
        IncorrectUsernameError: 401,
        NoSaltValueStored: 500,
        AttemptTooSoonError: 429,
        TooManyAttemptsError: 429,
      };
      handleError(authErr, req, res, true, code[authErr.name]);
    }
    // don't sign in if user is missing after authentication
    else if (!user) {
      if (req.body.redirect === false) res.json({ error: 'user is missing' });
      else res.redirect(req.body.server ? req.baseUrl + '/local' : process.env.PASSPORT_REDIRECT);
    } else {
      // sign in
      req.logIn(user, (err) => {
        if (err) handleError(err, req, res);
        else if (req.body.redirect === false) {
          deserializeUser({ _id: user._id, provider: user.provider, next_step: user.next_step }).then(
            (result) => {
              // error message
              if (typeof result === 'string') res.status(401).json({ error: result });
              // user object
              else res.json({ data: result });
            }
          );
        } else res.redirect(process.env.PASSPORT_REDIRECT);
      });
    }
  })(req, res, next);
});

export { router as authRouter };
