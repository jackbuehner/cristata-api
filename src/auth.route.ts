import dotenv from 'dotenv';
import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';

// load environmental variables
dotenv.config();

/**
 * Handle authentication errors.
 */
const handleError = (error: unknown, req: Request, res: Response) => {
  console.error(error);
  res.redirect(req.baseUrl + '/error');
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
    if (err) handleError(err, req, res);
    if (!user) res.redirect(process.env.PASSPORT_REDIRECT);
    req.logIn(user, (err) => {
      if (err) handleError(err, req, res);
      res.redirect(process.env.PASSPORT_REDIRECT);
    });
  })(req, res, next);
});
router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/error' }),
  (req: Request, res: Response) => {
    res.redirect(process.env.PASSPORT_REDIRECT);
  }
);

export { router as authRouter };
