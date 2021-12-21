import './mongodb/db';
import './passport';
import cookieSession from 'cookie-session';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
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
