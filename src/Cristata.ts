import { Server as Hocuspocus } from '@hocuspocus/server';
import { Application } from 'express';
import Keygrip from 'keygrip';
import semver from 'semver';
import url from 'url';
import ws from 'ws';
import helpers from './api/v3/helpers';
import { GenCollectionInput } from './api/v3/helpers/generators/genCollection';
import { apollo } from './apollo';
import { createExpressApp } from './app';
import { createMongooseModels, db } from './mongodb/db';
import { HocuspocusMongoDB } from './mongodb/HocuspocusMongoDB';
import teams from './mongodb/teams.collection.json';
import { users } from './mongodb/users';
import { Collection, Configuration } from './types/config';
import { hasKey } from './utils/hasKey';
import { parseCookies } from './utils/parseCookies';
import { wss } from './websocket';
import mongoose, { ObjectId } from 'mongoose';

function isCollection(toCheck: Collection | GenCollectionInput): toCheck is Collection {
  return hasKey('typeDefs', toCheck) && hasKey('resolvers', toCheck);
}

if (!process.env.COOKIE_SESSION_SECRET) throw new Error('COOKIE_SESSION_SECRET not defined in env');
if (!process.env.MONGO_DB_USERNAME) throw new Error('MONGO_DB_USERNAME not defined in env');
if (!process.env.MONGO_DB_PASSWORD) throw new Error('MONGO_DB_PASSWORD not defined in env');
if (!process.env.MONGO_DB_HOST) throw new Error('MONGO_DB_HOST not defined in env');

class Cristata {
  config: Record<string, Configuration> = {};
  #express: Application = undefined;
  #apolloWss: Record<string, ws.Server> = {};
  #tenants: string[] = [process.env.TENANT];

  constructor(config?: Configuration<Collection | GenCollectionInput>) {
    if (config) {
      // only require tenant to be in env if a config is provided
      if (!process.env.TENANT) throw new Error('TENANT not defined in env');

      this.config[process.env.TENANT] = constructCollections(config, process.env.TENANT);

      // initialize a subscription server for graphql subscriptions
      this.#apolloWss[process.env.TENANT] = new ws.Server({ noServer: true, path: `/v3` });
    }
    // NOTE: tenants will be fetch from the app db if a tenant is not provided to the constructor
  }

  /**
   * Starts the Cristata server.
   */
  async start(): Promise<void> {
    await this.#connectDb();

    // configure the server
    const hocuspocus = Hocuspocus.configure({
      port: parseInt(process.env.PORT),
      extensions: [new HocuspocusMongoDB(this.#tenants)],

      // use hocuspocus at '/hocupocus' and use wss at '/websocket'
      onUpgrade: async ({ request, socket, head }) => {
        try {
          const pathname = url.parse(request.url).pathname;
          const { searchParams } = new URL('https://cristata.app' + request.url);

          // ensure request has a valid tenant search param
          const tenant = searchParams.get('tenant');
          if (!tenant) throw new Error(`tenant search param must be specified`);
          if (!this.#tenants.includes(tenant)) throw new Error(`tenant must exist`);

          // find auth cookie
          if (!request.headers.cookie) {
            socket.end(); // end if no cookie is provided
            return;
          }
          const parsedCookies = parseCookies(request.headers.cookie);
          const authCookie = parsedCookies.find((cookie) => cookie.name === '__Host-cristata-session');
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

          const configs = Object.entries(this.config);
          const root = configs.length === 1;

          // if the cookie is untampered, use the following appropriate handlers
          if (pathname.indexOf('/hocuspocus/') === 0) {
            // ensure client is up-to-date
            const reqVersion = searchParams.get('version');
            const isClientUpdated = semver.gte(reqVersion, this.config[tenant].minimumClientVersion);
            if (!isClientUpdated) throw 'Client out of date!';

            // allow hocuspocus websocket to continue if the path starts with '/hocuspocus/
          } else if (pathname === '/websocket') {
            // use the wss websocket if the path is '/websocket
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          } else if (pathname === (root ? `/v3` : `/v3/${tenant}`)) {
            // handle apollo subscriptions
            this.#apolloWss[tenant].handleUpgrade(request, socket, head, (ws) => {
              this.#apolloWss[tenant].emit('connection', ws, request);
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
          // for each tenant with a config, create an api endpoint
          const configs = Object.entries(this.config);
          configs.forEach(async ([tenant, config]) =>
            apollo(
              this.app,
              hocuspocus.httpServer,
              this.#apolloWss[tenant],
              tenant,
              config,
              configs.length === 1
            )
          );
        } catch (error) {
          console.error(error);
        }
      },
    });

    // start the http server and hocuspocus websocket server
    try {
      hocuspocus
        .listen()
        .then(async () => {
          if (process.env.NODE_ENV === 'development') {
            try {
              console.clear();
              console.log(`\x1b[32mServer started successfully!\x1b[0m`);
              console.log(``);
              console.log(`You can now view \x1b[1m${process.env.npm_package_name}\x1b[0m in the browser.`);
              console.log(``);
              console.log(`  \x1b[1mLocal\x1b[0m:            http://localhost:${process.env.PORT}`);
              console.log(
                `  \x1b[1mOn Your Network\x1b[0m:  http://${(await import('address')).ip()}:${process.env.PORT}`
              );
              console.log();
              console.log(`To create a production build, use \x1b[36mnpm run build\x1b[0m.`);
              console.log(`To update JSON schemas, use \x1b[94mnpm run build:json-schema\x1b[0m.`);
              console.log(`To run tests, use \x1b[94mnpm run test\x1b[0m.`);
              console.log(``);

              const { ESLint } = await import('eslint');
              const eslint = new ESLint({ useEslintrc: true });
              console.log(`\x1b[36mChecking for issues...\x1b[0m`);
              const results = await eslint.lintFiles(['src/**/*']);
              const formatter = await eslint.loadFormatter('stylish');
              const resultText = formatter.format(results);
              if (resultText) console.log(resultText);

              const hasErrors = !!results.find((result) => result.errorCount > 0);
              if (hasErrors) process.exit(1);
              if (!resultText) {
                process.stdout.cursorTo(0);
                process.stdout.moveCursor(0, -1);
                process.stdout.clearLine(0);
                process.stdout.write(`\x1b[32mNo issues found.\x1b[0m\n`);
              }
            } catch (error) {
              console.error(`Error linting:`, error);
              process.exit(1);
            }
          } else {
            console.log(
              `Cristata server listening on port ${process.env.PORT}! API, authentication, webhooks, and hocuspocus are running.`
            );
          }
        })
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
    if (process.env.TENANT) await db(process.env.TENANT);
    else {
      await db();

      // get the tenants
      const tenantsCollection = mongoose.connection.db.collection('tenants');
      const tenants = await tenantsCollection
        .find<{ _id: ObjectId; name: string; config: Configuration }>({})
        .toArray();

      tenants.forEach(({ name, config }) => {
        // add each tenant to the config
        this.config[name] = constructCollections(config, name);
        this.#tenants.push(name);

        // initialize a subscription server for graphql subscriptions
        this.#apolloWss[name] = new ws.Server({
          noServer: true,
          path: tenants.length === 1 ? `/v3` : `/${name}/v3`,
        });
      });
    }

    // for each tenant with a config, create mongoose models
    const configs = Object.entries(this.config);
    await Promise.all(configs.map(async ([tenant, config]) => await createMongooseModels(config, tenant)));
  }

  /**
   * Gets the express app. Starts the app if it is not started.
   */
  get app(): Application {
    if (!this.#express) this.#express = createExpressApp();
    return this.#express;
  }
}

function constructCollections(
  config: Configuration<Collection | GenCollectionInput>,
  tenant: string
): Configuration {
  if (tenant === 'admin') throw new Error('cannot create a database for tenant with name "admin"');
  if (tenant === 'local') throw new Error('cannot create a database for tenant with name "local"');
  if (tenant === 'users') throw new Error('cannot create a database for tenant with name "users"');

  return {
    ...config,
    collections: [
      users(tenant),
      helpers.generators.genCollection(teams as unknown as GenCollectionInput, tenant),
      ...config.collections
        .filter((col): col is GenCollectionInput => !isCollection(col))
        .filter((col) => col.name !== 'User')
        .filter((col) => col.name !== 'Team')
        .map((col) => helpers.generators.genCollection(col, tenant)),
      ...config.collections
        .filter((col): col is Collection => isCollection(col))
        .filter((col) => col.name !== 'User')
        .filter((col) => col.name !== 'Team'),
    ],
  };
}

// keep errors silent
process.on('unhandledRejection', () => null);

export default Cristata;
