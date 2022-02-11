import corsAnywhere from 'cors-anywhere';
import crypto from 'crypto';
import { Router } from 'express';
import { Teams } from './config/database';
import { allowedOrigins } from './middleware/cors';
import { IDeserializedUser } from './passport';

/**
 * This router contains the proxy route.
 *
 * This router expects to be found at `/proxy`. It removes "/proxy" from the URL path, and proxies the rest of the URL.
 *
 * This proxy only works on allowed origins. See `allowedOrigins` in `/middleware/cors`.
 */
const router = Router();

// create a CORS proxy
const proxy = corsAnywhere.createServer({
  originWhitelist: [], // allow all origins
  requireHeader: [], // don't require headers
  removeHeaders: ['cookie', 'cookie2'], // do not forward cookies
});

// create the proxy route
router.get('/proxy/*', (req, res) => {
  req.url = req.url.replace('/proxy/', '/'); // strip '/proxy' from the front of the URL (otherwise, the proxy will not work)
  proxy.emit('request', req, res);
});

// send the analytics url
router.get('/analytics/dashboard', (req, res) => {
  if (req.isAuthenticated() && (req.user as IDeserializedUser).teams.includes(Teams.ADMIN)) {
    const password = crypto.createHash('sha256').update(process.env.FATHOM_DASHBOARD_PASSWORD).digest('hex'); // hash the password
    res.json({
      url: `https://app.usefathom.com/share/${process.env.FATHOM_SITE_ID}/wordpress?password=${password}`,
    });
  } else {
    res.status(403).end();
  }
});

export { router as proxyRouter };
