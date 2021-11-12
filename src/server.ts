import { Server as Hocuspocus } from '@hocuspocus/server';
import { HocuspocusMongoDB } from './mongodb/HocuspocusMongoDB';
import { wss } from './websocket';
import url from 'url';
import { app } from './app';
import { apollo, apolloWSS } from './apollo';
import { parseCookies } from './utils/parseCookies';
import Keygrip from 'keygrip';
import { allowedOrigins } from './middleware/cors';

// configure the server
const hocuspocus = Hocuspocus.configure({
  port: parseInt(process.env.PORT),
  extensions: [new HocuspocusMongoDB()],

  // use hocuspocus at '/hocupocus' and use wss at '/websocket'
  onUpgrade: async ({ request, socket, head }) => {
    try {
      const pathname = url.parse(request.url).pathname;
      const origin = request.headers.origin;

      // ensure request is from a allowed origin
      if (allowedOrigins.includes(origin) === false) {
        throw new Error(`${origin} is not allowed to access websockets`);
      }

      // find auth cookie
      const parsedCookies = parseCookies(request.headers.cookie);
      const { name, value, signature } = parsedCookies.find((cookie) => cookie.name === 'github-auth-session');

      // verify cookie integrity
      const keygrip = new Keygrip([process.env.COOKIE_SESSION_SECRET]);
      const isUntampered = keygrip.verify(`${name}=${value}`, signature);

      // if the cookie has been modified by the client, end the connection
      if (!isUntampered) {
        throw new Error(`session cookie has been tampered with by the client`);
      }

      // if the cookie is untampered, use the following appropriate handlers
      if (pathname.indexOf('/hocuspocus/') === 0) {
        // allow hocuspocus websocket to continue if the path starts with '/hocuspocus/
      } else if (pathname === '/websocket') {
        // use the wss websocket if the path is '/websocket
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else if (pathname === '/v3') {
        // handle apollo subscriptions
        apolloWSS.handleUpgrade(request, socket, head, (ws) => {
          apolloWSS.emit('connection', ws, request);
        });
      }
      // otherwise, end the websocket connection request
      else {
        socket.end();
      }
    } catch (error) {
      socket.end();
      console.error(error);
    }
  },

  onRequest: async ({ request, response }) => {
    // when a request is made to the server, load the app
    app(request, response);
  },

  onListen: async () => {
    apollo(app, hocuspocus.httpServer);
  },

  // don't allow client to stay connect if it is out of date
  onConnect: async ({ requestParameters }) => {
    const isClientUpdated = requestParameters.get('version') >= process.env.CLIENT_MINIMUM_VERSION;
    if (!isClientUpdated) {
      throw 'Client out of date!';
    }
  },
});

// start the http server and hocuspocus websocket server
hocuspocus
  .listen()
  .then(() =>
    console.log(
      `Cristata server listening on port ${process.env.PORT}! API, authentication, webhooks, and hocuspocus are running.`
    )
  )
  .catch((err: Error) =>
    console.error(
      `Failed to start Cristata  server on port ${process.env.PORT}! Message: ${JSON.stringify(err)}`
    )
  );

// keep errors silent
process.on('unhandledRejection', () => null);

// make the http server available as its own variable
const { httpServer } = hocuspocus;

export { httpServer as server };
