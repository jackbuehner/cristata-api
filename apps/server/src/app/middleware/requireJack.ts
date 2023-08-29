import { NextFunction, Request, Response } from 'express';
import { IDeserializedUser } from '../passport';

/**
 * Requires the user to be Jack on the troop-370 tenant
 */
const requireJack = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    res.status(401).end();
    return;
  }

  const user = req.user as IDeserializedUser;

  if (user.tenant === 'troop-370' && user._id.toHexString() === '60cfb15e6fcbf30015d0066f') {
    next();
  } else {
    res.status(403).end();
  }
};

export { requireJack };
