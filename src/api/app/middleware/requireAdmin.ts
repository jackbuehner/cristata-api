import { Request, Response, NextFunction } from 'express';
import { IDeserializedUser } from '../passport';

/**
 * Middleware to be use on specific routes to require authentication.
 * If `req.user` is defined and `req.user.teams` includes the admin
 * team id ('000000000000000000000001'), go to next step.
 * Otherwise, return HTTP error to 403 to the client.
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const isAuthenticated = req.isAuthenticated();
  const isAdmin = (req.user as IDeserializedUser).teams.includes('000000000000000000000001');

  if (isAuthenticated && isAdmin) {
    next();
  } else {
    res.status(403).end();
  }
};

export { requireAdmin };
