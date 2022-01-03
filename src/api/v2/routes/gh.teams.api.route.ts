import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import { getTeams } from '../models/gh.teams.api.model';
const teamsRouter = Router();

teamsRouter.get('/', async (req: Request, res: Response) => {
  getTeams(req.user as IDeserializedUser, res);
});

export { teamsRouter };
