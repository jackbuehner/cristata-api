import dotenv from 'dotenv';
import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import { requireAuth } from './middleware/requireAuth';
import { deserializeUser } from './passport';

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
router.post('/local', (req: Request, res: Response, next: NextFunction) => {
  // get then tenant so we know which local strategy to use
  const searchParams = req.query as unknown as URLSearchParams;
  const tenant = searchParams.get('tenant');

  // use the local strategy for the provided tenant
  passport.authenticate(`local-${tenant}`, (err: Error | null, user, authErr: Error) => {
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
      else res.redirect(req.body.server ? req.baseUrl + '/local' : process.env.APP_URL + '/sign-in');
    } else {
      // sign in
      req.logIn(user, (err) => {
        if (err) handleError(err, req, res);
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
        } else res.redirect(process.env.APP_URL + '/sign-in');
      });
    }
  })(req, res, next);
});

export { router as authRouter };
