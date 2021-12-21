import { Router } from 'express';
import { articlesRouter } from './articles.api.routes';
import { flushRouter } from './flush.api.route';
import { orgProjectsRouter } from './gh.org.projects.api.route';
import { orgRouter } from './gh.org.api.route';
import { photoRequestsRouter } from './photoRequests.api.routes';
import { photosRouter } from './photos.api.route';
import { projectsRouter } from './gh.projects.api.route';
import { s3Router } from './s3.route';
import { satireRouter } from './satire.api.route';
import { shorturlRouter } from './shorturl.api.route';
import { settingsRouter } from './settings.api.route';
import { teamDiscussionsRouter } from './gh.teams.discussions.api.route';
import { teamsRouter } from './gh.teams.api.route';
import { usersRouter } from './users.api.routes';

/**
 * Router for all API v2 endpoints.
 *
 * __This API is depreciated. It has many known bugs. Use at your own risk.__
 */
const router = Router();

router.use('/', s3Router);
router.use('/articles', articlesRouter);
router.use('/flush', flushRouter);
router.use('/gh/org', orgRouter);
router.use('/gh/org/projects', orgProjectsRouter);
router.use('/gh/projects', projectsRouter);
router.use('/gh/teams', teamsRouter);
router.use('/gh/teams/discussions', teamDiscussionsRouter);
router.use('/photo-requests', photoRequestsRouter);
router.use('/photos', photosRouter);
router.use('/satire', satireRouter);
router.use('/settings', settingsRouter);
router.use('/shorturl', shorturlRouter);
router.use('/users', usersRouter);

export { router as apiRouter2 };
