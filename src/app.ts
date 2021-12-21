import './mongodb/db';
import './passport';
import cookieSession from 'cookie-session';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import passport from 'passport';
import { apiRouter2 } from './api/v2/routes';
import { githubWebhookHandler } from './api/v2/webhooks/github';
import { apiRouter3 } from './api/v3/routes';
import { authRouter } from './auth.route';
import { requireAuth } from './middleware/auth';
import { corsConfig } from './middleware/cors';
import { proxyRouter } from './proxy.route';

// load environmental variables
dotenv.config();

// create express app
const app = express();

// secure app with helmet
app.use(
  helmet({
    // use default content security policy
    contentSecurityPolicy: true,
    // sets "Cross-Origin-Embedder-Policy: require-corp"
    // to prevent documents from loading cross-origin resources that do not
    // explicitly grant permission
    crossOriginEmbedderPolicy: true,
    // sets "Cross-Origin-Opener-Policy: same-origin" to ensure that top-level
    // documents do not share a browsing context group with cross-origin
    // documents
    crossOriginOpenerPolicy: true,
    // sets "Cross-Origin-Resource-Policy: same-origin"
    crossOriginResourcePolicy: true,
    // allow prefetching since the server does not have external URLS to
    // untrusted websites
    dnsPrefetchControl: {
      allow: true,
    },
    // sets the Expect-CT header, which helps mitigate misissued SSL certificates
    expectCt: true,
    // sets "X-Frame-Options: SAMEORIGIN"
    frameguard: true,
    // removes the X-Powered-By header
    hidePoweredBy: true,
    // prefer HTTPS over insecure HTTP
    hsts: true,
    // forces potentially-unsafe downloads to be saved instead of opened in browser
    // to prevent unknown HTML from executing in site's context
    ieNoOpen: true,
    // sets "X-Content-Type-Options: nosniff" to prevent MIME sniffing
    noSniff: true,
    // sets "X-Permitted-Cross-Domain-Policies: none"
    permittedCrossDomainPolicies: true,
    // sets "Referrer-Policy: no-referrer"
    referrerPolicy: true,
    // disable xss filter, which actually causes xss vulnerabilities
    xssFilter: true,
  })
);

// use URL search params for query variable
app.set('query parser', (queryString: string) => {
  return new URLSearchParams(queryString);
});

// enable CORS for the app
app.use(cors(corsConfig));

// parse incoming request body as applciation/json
app.use(express.json());
app.set('json spaces', 2); // pretty print

// store session in the client cookie
app.use(
  cookieSession({
    name: 'github-auth-session',
    secret: process.env.COOKIE_SESSION_SECRET,
    domain: process.env.BASE_DOMAIN,
  })
);

// initialize passport
app.use(passport.initialize({ userProperty: 'user' }));
app.use(passport.session()); // replace `req.user` with passport user

app.use('/auth', authRouter); // authentication routes
app.use(githubWebhookHandler); // recieve and handle webhook payloads from GitHub
app.use('/api/v2', apiRouter2); // API v2 routes
app.use('/v2', apiRouter2);
app.use('/v3', apiRouter3); // API v3 routes
app.use('/', proxyRouter); // CORS proxy routes

app.get('/', requireAuth, (req: Request, res: Response) => {
  res.send(`Cristata API Server`);
});

export { app };
