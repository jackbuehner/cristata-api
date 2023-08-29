import { Router } from 'express';
import { writeHeapSnapshot } from 'node:v8';
import { requireAdmin } from '../../app/middleware/requireAdmin';
import { requireJack } from '../../app/middleware/requireJack';
import { IDeserializedUser } from '../../app/passport';

/**
 * This router contains the proxy route.
 *
 * This router expects to be found at `/proxy`. It removes "/proxy" from the URL path, and proxies the rest of the URL.
 *
 * This proxy only works on allowed origins. See `allowedOrigins` in `/middleware/cors`.
 */
function factory(): Router {
  const router = Router();

  router.get('/new', requireAdmin, requireJack, async (req, res) => {
    const user = req.user as IDeserializedUser;

    console.log('Generating heap snapshot...');
    console.log(`       User: ${user.name}`);
    console.log(`       ID: ${user._id}`);
    console.log(`       Tenant: ${user.tenant}`);
    // see https://nodejs.org/api/v8.html#v8writeheapsnapshotfilenameoptions
    const path = writeHeapSnapshot();
    console.log(`    ...Done.`);
    res.download(path);
  });

  router.get('/', requireAdmin, requireJack, async (req, res) => {
    res.end();
  });

  return router;
}

export { factory as heapRouterFactory };
