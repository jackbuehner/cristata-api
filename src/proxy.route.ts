import corsAnywhere from 'cors-anywhere';
import crypto from 'crypto';
import { Router } from 'express';
import { requireAdmin } from './middleware/requireAdmin';

/**
 * This router contains the proxy route.
 *
 * This router expects to be found at `/proxy`. It removes "/proxy" from the URL path, and proxies the rest of the URL.
 *
 * This proxy only works on allowed origins. See `allowedOrigins` in `/middleware/cors`.
 */
function factory(): Router {
  const router = Router();

  // create a CORS proxy
  const proxy = corsAnywhere.createServer({
    originWhitelist: [`https://cristata.app`, /\.example2\.com$/], // only allow from cristata.app and its subdomains
    requireHeader: [], // don't require headers
    removeHeaders: ['cookie', 'cookie2'], // do not forward cookies
  });

  // create the proxy route
  router.get('/proxy/*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/'); // strip '/proxy' from the front of the URL (otherwise, the proxy will not work)
    proxy.emit('request', req, res);
  });

  // send the analytics url
  router.get('/analytics/dashboard', requireAdmin, (req, res) => {
    const password = crypto.createHash('sha256').update(process.env.FATHOM_DASHBOARD_PASSWORD).digest('hex'); // hash the password
    res.json({
      url: `https://app.usefathom.com/share/${process.env.FATHOM_SITE_ID}/wordpress?password=${password}`,
    });
  });

  return router;
}

export { factory as proxyRouterFactory };
