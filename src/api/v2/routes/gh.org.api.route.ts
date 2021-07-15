import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import { postOrgInvitation } from '../models/gh.org.model';
const orgRouter = Router();

orgRouter.post('/invite', async (req: Request, res: Response) => {
  postOrgInvitation(req.user as IProfile, res);
});

export { orgRouter };
