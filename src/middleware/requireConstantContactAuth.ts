import { NextFunction, Request, Response } from 'express';
import { refreshConstantContactTokens } from '../api/v3/routes/constant-contact.route';
import { IDeserializedUser } from '../passport';

async function requireConstantContactAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(403).end();
    return;
  }

  const user = req.user as IDeserializedUser;
  if (!user.constantcontact?.access_token) {
    res.status(403).end();
    return;
  }

  // refresh tokens if token expired or will expire within two hours
  if (user.constantcontact.expires_at < new Date().getTime() - (1000 * 60 * 60 - 2)) {
    await refreshConstantContactTokens(user.tenant, user._id, user.constantcontact.refresh_token);
  }

  next();
}

export { requireConstantContactAuth };
