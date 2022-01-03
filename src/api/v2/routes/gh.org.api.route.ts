import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import { postOrgInvitation } from '../models/gh.org.model';
const orgRouter = Router();

orgRouter.post('/invite', async (req: Request, res: Response) => {
  postOrgInvitation(req.user as IDeserializedUser, res);
});

export { orgRouter };
