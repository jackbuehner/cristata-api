import { Router } from 'express';
import { orgProjectsRouter } from './gh.org.projects.api.route';
import { orgRouter } from './gh.org.api.route';
import { projectsRouter } from './gh.projects.api.route';
import { s3Router } from './s3.route';

/**
 * Router for all API v2 endpoints.
 *
 * __This API is depreciated. It has many known bugs. Use at your own risk.__
 */
const router = Router();

router.use('/', s3Router);
router.use('/gh/org', orgRouter);
router.use('/gh/org/projects', orgProjectsRouter);
router.use('/gh/projects', projectsRouter);

export { router as apiRouter2 };
