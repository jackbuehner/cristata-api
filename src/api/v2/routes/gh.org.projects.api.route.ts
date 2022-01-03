import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import { getOrgProjects } from '../models/gh.org.projects.api.model';
const orgProjectsRouter = Router();

orgProjectsRouter.get('/', async (req: Request, res: Response) => {
  getOrgProjects(req.user as IDeserializedUser, res);
});

export { orgProjectsRouter };
