import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to be use on specific routes to require authentication.
 * If `req.user` is defined, go to next step. Otherwise, redirect client to
 * `/auth`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    next();
  } else {
    res.status(401).end();
  }
};

export { requireAuth };
