import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import {
  getTeamDiscussions,
  getTeamDiscussion,
  getTeamDiscussionComments,
} from '../models/gh.teams.discussions.api.model';
const teamDiscussionsRouter = Router();

// get discussions in a team
teamDiscussionsRouter.get('/:team_slug', async (req: Request, res: Response) => {
  getTeamDiscussions(
    req.params.team_slug,
    req.query.last?.toString(),
    req.query.before?.toString(),
    req.user as IProfile,
    res
  );
});

// get a single discussion
teamDiscussionsRouter.get('/:team_slug/:discussion_number', async (req: Request, res: Response) => {
  getTeamDiscussion(req.params.team_slug, req.params.discussion_number, req.user as IProfile, res);
});

// get comments for a discussion
teamDiscussionsRouter.get('/:team_slug/:discussion_number/comments', async (req: Request, res: Response) => {
  getTeamDiscussionComments(req.params.team_slug, req.params.discussion_number, req.user as IProfile, res);
});

export { teamDiscussionsRouter };
