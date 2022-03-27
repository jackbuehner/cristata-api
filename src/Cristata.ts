import { Server as Hocuspocus } from '@hocuspocus/server';
import { Application } from 'express';
import Keygrip from 'keygrip';
import url from 'url';
import helpers from './api/v3/helpers';
import { GenCollectionInput } from './api/v3/helpers/generators/genCollection';
import { apollo, apolloWSS } from './apollo';
import { createExpressApp } from './app';
import { db } from './mongodb/db';
import { HocuspocusMongoDB } from './mongodb/HocuspocusMongoDB';
import { Collection, Configuration } from './types/config';
import { hasKey } from './utils/hasKey';
import { parseCookies } from './utils/parseCookies';
import { wss } from './websocket';
import semver from 'semver';

function isCollection(toCheck: Collection | GenCollectionInput): toCheck is Collection {
  return hasKey('typeDefs', toCheck) && hasKey('resolvers', toCheck);
}

class Cristata {
  config: Configuration = undefined;
  #express: Application = undefined;

  constructor(config: Configuration<Collection | GenCollectionInput>) {
    this.config = {
      ...config,
      collections: [
        ...config.collections
          .filter((col): col is GenCollectionInput => !isCollection(col))
          .filter((col) => col.name !== 'User')
          .filter((col) => col.name !== 'Team')
          .map((col) => helpers.generators.genCollection(col)),
        ...config.collections
          .filter((col): col is Collection => isCollection(col))
          .filter((col) => col.name !== 'User')
          .filter((col) => col.name !== 'Team'),
      ],
    };
  }

  /**
   * Starts the Cristata server.
   */
  async start(): Promise<void> {
    await this.#connectDb();

    // configure the server
    const hocuspocus = Hocuspocus.configure({
      port: parseInt(process.env.PORT),
      extensions: [new HocuspocusMongoDB(this.config)],

      // use hocuspocus at '/hocupocus' and use wss at '/websocket'
      onUpgrade: async ({ request, socket, head }) => {
        try {
          let pathname = url.parse(request.url).pathname;
          const origin = request.headers.origin;

          // ensure request is from a allowed origin
          if (this.config.allowedOrigins.includes(origin) === false) {
            throw new Error(`${origin} is not allowed to access websockets`);
          }

          // remove prefix from pathname
          if (process.env.TENANT) {
            pathname = pathname.replace(`/${process.env.TENANT}`, '');
          }

          // find auth cookie
          if (!request.headers.cookie) {
            socket.end(); // end if no cookie is provided
            return;
          }
          const parsedCookies = parseCookies(request.headers.cookie);
          const authCookie = parsedCookies.find((cookie) => cookie.name === 'github-auth-session');
          if (!authCookie) {
            socket.end(); // end if no auth cookie
            return;
          }

          // verify cookie integrity
          const keygrip = new Keygrip([process.env.COOKIE_SESSION_SECRET]);
          const { name, value, signature } = authCookie;
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
        try {
          // when a request is made to the server, load the app
          this.app(request, response);
        } catch (error) {
          response.destroy();
          console.error(error);
        }
      },

      onListen: async () => {
        try {
          apollo(this.app, hocuspocus.httpServer, this.config);
        } catch (error) {
          console.error(error);
        }
      },

      // don't allow client to stay connect if it is out of date
      onConnect: async ({ requestParameters }) => {
        try {
          const isClientUpdated = semver.gte(
            requestParameters.get('version'),
            this.config.minimumClientVersion
          );
          if (!isClientUpdated) {
            throw 'Client out of date!';
          }
        } catch (error) {
          console.error(error);
        }
      },
    });

    // start the http server and hocuspocus websocket server
    try {
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
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Connect to the database and initialize mongoose.
   */
  async #connectDb(): Promise<void> {
    await db(this.config);
  }

  /**
   * Gets the express app. Starts the app if it is not started.
   */
  get app(): Application {
    if (!this.#express) this.#express = createExpressApp();
    return this.#express;
  }
}

// keep errors silent
process.on('unhandledRejection', () => null);

export default Cristata;
