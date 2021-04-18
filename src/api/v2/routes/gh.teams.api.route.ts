import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import { getTeams } from '../models/gh.teams.api.model';
const teamsRouter = Router();

teamsRouter.get('/', async (req: Request, res: Response) => {
  getTeams(req.user as IProfile, res);
});

export { teamsRouter };
