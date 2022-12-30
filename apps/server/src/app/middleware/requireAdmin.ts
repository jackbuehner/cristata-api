import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { IDeserializedUser } from '../passport';

/**
 * Middleware to be use on specific routes to require authentication.
 * If `req.user` is defined and the users `teams` array in the database
 * includes the admin team id ('000000000000000000000001'), go to next step.
 * Otherwise, return HTTP error to 403 to the client.
 */
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const isAuthenticated = req.isAuthenticated();
  if (!isAuthenticated) {
    res.status(401).end();
    return;
  }

  const user = req.user as IDeserializedUser;
  const tenant = user.tenant;

  const conn = global.mongoose?.app?.conn?.useDb(tenant);
  if (!conn) {
    res.status(500).end();
    return;
  }

  const userTeams = await conn.db
    .collection('teams')
    .find(
      {
        $or: [
          { organizers: new mongoose.Types.ObjectId(user._id) },
          { members: new mongoose.Types.ObjectId(user._id) },
        ],
      },
      { projection: { _id: 1 } }
    )
    .toArray();

  const isAdmin = userTeams?.map((team) => team._id.toHexString()).includes('000000000000000000000001');

  if (isAdmin) {
    next();
  } else {
    res.status(403).end();
  }
};

export { requireAdmin };
