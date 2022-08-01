import { Router } from 'express';
import { rootRouter } from './root.route';
import { constantContactRouter } from './constant-contact.route';

/**
 * Router for all API v3 endpoints.
 */
const router = Router();

router.use('/', rootRouter);
router.use('/constant-contact', constantContactRouter);

export { router as apiRouter3 };
