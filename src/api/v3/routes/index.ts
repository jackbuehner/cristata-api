import { Router } from 'express';
import { rootRouter } from './root.route';

/**
 * Router for all API v3 endpoints.
 */
const router = Router();

router.use('/', rootRouter);

export { router as apiRouter3 };
