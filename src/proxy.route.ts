import { allowedOrigins } from './middleware/cors';
import corsAnywhere from 'cors-anywhere';
import { Router } from 'express';

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
  originWhitelist: allowedOrigins, // allow all origins
  requireHeader: [], // don't require headers
  removeHeaders: ['cookie', 'cookie2'], // do not forward cookies
});

// create the proxy route
router.get('/proxy/*', (req, res) => {
  req.url = req.url.replace('/proxy/', '/'); // strip '/proxy' from the front of the URL (otherwise, the proxy will not work)
  proxy.emit('request', req, res);
});

export { router as proxyRouter };
