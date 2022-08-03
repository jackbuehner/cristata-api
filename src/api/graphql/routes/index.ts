import { Router } from 'express';
import Cristata from '../../../Cristata';
import { constantContactRouter } from './constant-contact.route';
import { rootRouter } from './root.route';

/**
 * Router for all API v3 endpoints.
 */
function factory(cristata: Cristata): Router {
  const router = Router();

  router.use('/', rootRouter);
  router.use('/constant-contact', constantContactRouter(cristata));
  return router;
}

export { factory as apiRouter3 };
