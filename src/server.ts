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

// set up websocket server for sending data to app
import WebSocket from 'ws';
import { createServer } from 'http';
const server = createServer();
const wss = new WebSocket.Server({
  server: server,
});
server.on('request', app);

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
    res.redirect('/');
  }
);

app.get('/', requireAuth, (req: Request, res: Response) => {
  res.send(`Hello world!`);
});

// auth route
app.get('/auth', (req: Request, res: Response) => {
  if (req.user) {
    res.send(JSON.stringify(req.user));
  } else {
    res.status(403).end();
  }
});

// allow client to sign out
app.get('/auth/clear', (req: Request, res: Response) => {
  req.session = null;
  req.logout();
  res.redirect('/');
});

// recieve webhook payloads from github
import GithubWebHook from 'express-github-webhook';
const githubWebhookHandler = GithubWebHook({
  path: '/payload/github',
  secret: process.env.GITHUB_PAYLOAD_SECRET,
});
app.use(githubWebhookHandler);

// handle incoming webhook payloads from github
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

// keep track of the github payload events that the client requests
class Clients {
  constructor() {
    this.clientEvents = {};
    this.saveClient = this.saveClient.bind(this);
  }
  clientEvents: { [key: string]: string[] };
  saveClient(id: string, events: string[]) {
    this.clientEvents[id] = events;
  }
}
const clients = new Clients();

/**
 * Returns whether the input is valid JSON.
 */
function isValidJSON(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

interface WebSocketExtended extends WebSocket {
  id?: string;
  isAlive?: boolean;
}

wss.on('error', (err) => {
  console.error(err);
});

wss.on('connection', function connection(ws: WebSocketExtended) {
  // handle any errors
  ws.on('error', (err) => {
    console.error(err);
  });

  // set `isAlive` to true
  ws.isAlive = true;

  // handle incoming messages
  ws.on('message', function incoming(message) {
    // require messages to be valid JSON
    if (isValidJSON(message)) {
      const parsedMessage = JSON.parse(message as string);

      // if the message is sending client information, save that info for later
      if (parsedMessage.type === 'client_info') {
        const data = parsedMessage as { type: 'client_info'; id: string; events: string[] };
        clients.saveClient(data.id, data.events);
        // save the ID to the websocket instance for later use
        ws.id = data.id;
      }
    } else {
      ws.emit('error', 'Message must be valid JSON');
      ws.send('Error: Message must be valid JSON');
    }
  });

  ws.send('Connected to websocket server');

  wss.on('github_payload_received', (data: string) => {
    const parsedData: { event: string; [key: string]: unknown } = JSON.parse(data);
    // only send the data is the client requested the event
    if (ws.id && clients.clientEvents[ws.id].includes(parsedData.event)) {
      ws.send(data);
    }
  });

  ws.on('pong', () => {
    // set `isAlive` on every pong so that we know that the ws is still connected
    ws.isAlive = true;
  });
});

// frequently ping the websocket clients to keep them connected
const wsPingCheck = setInterval(() => {
  wss.clients.forEach((ws: WebSocketExtended) => {
    // if websocket is not alive but still active on the server, terminate it
    // (might have occurred if server did not detect that client disconnected)
    if (ws.isAlive === false) return ws.terminate();

    // check if websocket is alive
    ws.isAlive = false; // set to false (the 'pong' event will set it to true)
    ws.ping(); // ping the client
  });
}, 45000); // check every 45 seconds

// clean up any functions that depend on the websocket server
wss.on('close', () => {
  clearInterval(wsPingCheck);
});

// start the express and websocket server
server.listen(process.env.PORT, () => console.log(`Cristata server listening on port ${process.env.PORT}!`));
