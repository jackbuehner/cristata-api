import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import cookieSession from 'cookie-session';
import './passport';
import { requireAuth } from './middleware/auth';
import './mongodb/db';

// load environmental variables
dotenv.config();

// create express app
const app = express();

// return JSON in a nice format
app.set('json spaces', 2);

// allow CORS for the app
const allowedOrigins = ['http://localhost:3000', 'https://thepaladin.cristata.app']; // allowed orgins
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow requests with no origin
      if (allowedOrigins.indexOf(origin) === -1) {
        const message = 'The CORS policy for this origin does not allow access from the particular origin.';
        return callback(new Error(message), false);
      }
      return callback(null, true);
    },
    credentials: true, // set cookies on client
  })
); // TODO: in production, only allow certain domains

// parse incoming request body as applciation/json
app.use(express.json());

// handle authentication ------------------------------------------------------
// cookies
app.use(
  cookieSession({
    name: 'github-auth-session',
    secret: process.env.COOKIE_SESSION_SECRET,
    domain: process.env.BASE_DOMAIN,
  })
);

// initialize passport and passport sessions as middlware
app.use(passport.initialize());
app.use(passport.session());

// auth error route
app.get('/auth/error', (req: Request, res: Response) => res.send('Unknown Error'));

// redirect client to github for authentication
app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['user:email', 'read:org', 'write:org', 'read:discussion'] })
);

// listen for github auth response
app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/error' }),
  (req: Request, res: Response) => {
    const location =
      process.env.NODE_ENV === 'production'
        ? `https://thepaladin.cristata.app/sign-in`
        : `http://localhost:3000/sign-in`;
    res.redirect(location);
  }
);

app.get('/', requireAuth, (req: Request, res: Response) => {
  res.send(`Hello world!`);
});

// auth route
app.get('/auth', (req: Request, res: Response) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(403).end();
  }
});

// allow client to sign out
app.get('/auth/clear', (req: Request, res: Response) => {
  req.session = null;
  req.logout();
  const location =
    process.env.NODE_ENV === 'production'
      ? `https://thepaladin.cristata.app/sign-in`
      : `http://localhost:3000/sign-in`;

  res.redirect(location);
});

// recieve webhook payloads from github
import GithubWebHook from 'express-github-webhook';
const githubWebhookHandler = GithubWebHook({
  path: '/payload/github',
  secret: process.env.GITHUB_PAYLOAD_SECRET,
});
app.use(githubWebhookHandler);

// handle incoming webhook payloads from github
import { wss } from './websocket';
githubWebhookHandler.on('project_card', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project_card',
    project_id: parseInt((data.project_card as { project_url: string }).project_url.split('/').pop()), // get the project id by popping it from the end of the project url
    column_id: (data.project_card as { column_id: number }).column_id,
    card_id: (data.project_card as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});
githubWebhookHandler.on('project_column', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project_column',
    project_id: parseInt((data.project_column as { project_url: string }).project_url.split('/').pop()), // get the project id by popping it from the end of the project url
    column_id: (data.project_column as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});
githubWebhookHandler.on('project', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project',
    project_id: (data.project as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});

// create a route for the articles api
import { articlesRouter } from './api/v2/routes/articles.api.routes';
app.use('/api/v2/articles', articlesRouter);

// users api
import { usersRouter } from './api/v2/routes/users.api.routes';
app.use('/api/v2/users', usersRouter);

// users api
import { photoRequestsRouter } from './api/v2/routes/photoRequests.api.routes';
app.use('/api/v2/photo-requests', photoRequestsRouter);

// gh org projects api
import { orgProjectsRouter } from './api/v2/routes/gh.org.projects.api.route';
app.use('/api/v2/gh/org/projects', orgProjectsRouter);

// gh projects api
import { projectsRouter } from './api/v2/routes/gh.projects.api.route';
app.use('/api/v2/gh/projects', projectsRouter);

// gh teams api
import { teamsRouter } from './api/v2/routes/gh.teams.api.route';
app.use('/api/v2/gh/teams', teamsRouter);

// gh team discussions api
import { teamDiscussionsRouter } from './api/v2/routes/gh.teams.discussions.api.route';
app.use('/api/v2/gh/teams/discussions', teamDiscussionsRouter);

export { app };
