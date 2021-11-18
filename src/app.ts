import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { allowedOrigins, corsConfig } from './middleware/cors';
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

// use URL search params for query variable
app.set('query parser', (queryString: string) => {
  return new URLSearchParams(queryString);
});

// enable CORS for the app
app.use(cors(corsConfig));

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
  passport.authenticate('github', { scope: ['user', 'read:org', 'write:org', 'read:discussion'] })
);

// listen for github auth response
app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/error' }),
  (req: Request, res: Response) => {
    res.redirect(process.env.PASSPORT_REDIRECT);
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
  const location = `${process.env.BASE_DOMAIN_PROTOCOL}://${process.env.BASE_DOMAIN}/sign-in`;
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

// satire articles api
import { satireRouter } from './api/v2/routes/satire.api.route';
app.use('/api/v2/satire', satireRouter);

// users api
import { usersRouter } from './api/v2/routes/users.api.routes';
app.use('/api/v2/users', usersRouter);

// photo requests api
import { photoRequestsRouter } from './api/v2/routes/photoRequests.api.routes';
app.use('/api/v2/photo-requests', photoRequestsRouter);

// photos api
import { photosRouter } from './api/v2/routes/photos.api.route';
app.use('/api/v2/photos', photosRouter);

// short urls api
import { shorturlRouter } from './api/v2/routes/shorturl.api.route';
app.use('/api/v2/shorturl', shorturlRouter);

// royal flush api
import { flushRouter } from './api/v2/routes/flush.api.route';
app.use('/api/v2/flush', flushRouter);

// get signed s3 url
import aws from 'aws-sdk';
app.get('/api/v2/sign-s3', (req: Request, res: Response) => {
  const s3 = new aws.S3();
  const fileName = (req.query as unknown as URLSearchParams).get('file-name');
  const fileType = (req.query as unknown as URLSearchParams).get('file-type');
  const s3Bucket = (req.query as unknown as URLSearchParams).get('s3-bucket');

  if (!fileName) return res.status(400).json('Missing query "file-name"');
  if (!fileType) return res.status(400).json('Missing query "file-type"');
  if (!s3Bucket) return res.status(400).json('Missing query "s3-bucket"');

  const s3Params = {
    Bucket: s3Bucket,
    Key: fileName,
    Expires: 300, // 5 minutes for upload (some photos are big)
    ContentType: fileType,
    ACL: 'public-read',
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).end();
    }
    const returnData = {
      signedRequest: data,
      url: `https://${s3Bucket}.s3.amazonaws.com/${fileName}`,
    };
    res.json(returnData);
  });
});

// gh org projects api
import { orgProjectsRouter } from './api/v2/routes/gh.org.projects.api.route';
app.use('/api/v2/gh/org/projects', orgProjectsRouter);

// gh projects api
import { projectsRouter } from './api/v2/routes/gh.projects.api.route';
app.use('/api/v2/gh/projects', projectsRouter);

// gh org api
import { orgRouter } from './api/v2/routes/gh.org.api.route';
app.use('/api/v2/gh/org', orgRouter);

// gh teams api
import { teamsRouter } from './api/v2/routes/gh.teams.api.route';
app.use('/api/v2/gh/teams', teamsRouter);

// gh team discussions api
import { teamDiscussionsRouter } from './api/v2/routes/gh.teams.discussions.api.route';
app.use('/api/v2/gh/teams/discussions', teamDiscussionsRouter);

// settings api
import { settingsRouter } from './api/v2/routes/settings.api.route';
app.use('/api/v2/settings', settingsRouter);

// get history of documents in mongodb that have history tracked
import mongoose from 'mongoose';
import { IArticleDoc } from './mongodb/articles.model';

// get the 10 recent history changes
app.get('/api/v2/history', (req, res) => {
  mongoose
    .model<IArticleDoc>('Article')
    .aggregate([
      { $match: { history: { $elemMatch: { type: { $in: ['created', 'patched', 'hidden'] } } } } },
      { $sort: { 'timestamps.modified_at': -1 } },
      { $limit: 10 },
      { $addFields: { collection: 'articles' } },
      {
        $unionWith: {
          coll: 'photorequests',
          pipeline: [
            { $match: { history: { $elemMatch: { type: { $in: ['created', 'patched', 'hidden'] } } } } },
            { $sort: { 'timestamps.modified_at': -1 } },
            { $limit: 10 },
            { $addFields: { collection: 'photo-requests' } },
          ],
        },
      },
      {
        $unionWith: {
          coll: 'photos',
          pipeline: [
            { $match: { history: { $elemMatch: { type: { $in: ['created', 'patched', 'hidden'] } } } } },
            { $sort: { 'timestamps.modified_at': -1 } },
            { $limit: 10 },
            { $addFields: { collection: 'photos' } },
          ],
        },
      },
      { $sort: { 'timestamps.modified_at': -1 } },
      {
        $unset: [
          'body',
          'people',
          'permissions',
          'categories',
          'stage',
          'description',
          'photo_path',
          'timestamps',
          'locked',
          'tags',
          'hidden',
          'photo_caption',
          'article_id',
        ],
      },
    ])
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json(error);
    });
});

// create a CORS proxy
import corsAnywhere from 'cors-anywhere';
const proxy = corsAnywhere.createServer({
  originWhitelist: allowedOrigins, // allow all origins
  requireHeader: [], // don't require headers
  removeHeaders: ['cookie', 'cookie2'],
});
app.get('/proxy/*', (req, res) => {
  req.url = req.url.replace('/proxy/', '/'); // Strip '/proxy' from the front of the URL, else the proxy won't work.
  proxy.emit('request', req, res);
});

export { app };
