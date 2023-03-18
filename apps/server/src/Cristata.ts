import { hasChangeStreamNamespace, replaceCircular, unflattenObject } from '@jackbuehner/cristata-utils';
import { Logtail } from '@logtail/node';
import { Application, Router } from 'express';
import http from 'http';
import { ObjectId } from 'mongoose';
import { Collection as MongoCollection } from 'mongoose/node_modules/mongodb';
import { createExpressApp } from './app';
import { GenCollectionInput } from './graphql/helpers/generators/genCollection';
import { apollo } from './graphql/server';
import { connectDb } from './mongodb/connectDB';
import { Collection, Configuration } from './types/config';
import { constructCollections } from './utils/constructCollections';

if (!process.env.COOKIE_SESSION_SECRET) throw new Error('COOKIE_SESSION_SECRET not defined in env');
if (!process.env.MONGO_DB_USERNAME) throw new Error('MONGO_DB_USERNAME not defined in env');
if (!process.env.MONGO_DB_PASSWORD) throw new Error('MONGO_DB_PASSWORD not defined in env');
if (!process.env.MONGO_DB_HOST) throw new Error('MONGO_DB_HOST not defined in env');
if (!process.env.AWS_SECRET_KEY_ID) throw new Error('AWS_SECRET_KEY_ID not defined in env');
if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS_SECRET_ACCESS_KEY not defined in env');
if (!process.env.PORT) throw new Error('PORT not defined in env');

class Cristata {
  config: Record<string, Configuration> = {};
  #express: Application | undefined = undefined;
  #apolloMiddleware: Record<string, Router> = {};
  #stopApollo: Record<string, () => Promise<void>> = {};
  tenants: string[] = [];
  hasTenantPaid: Record<string, boolean> = {};
  canTenantAllowDiskUse: Record<string, boolean> = {};
  tenantsCollection: MongoCollection<TenantsCollectionSchema> | null = null;
  server = http.createServer();
  logtail = new Logtail(process.env.LOGTAIL_ID || 'MISSING');

  constructor(config?: Configuration<Collection | GenCollectionInput>) {
    if (config) {
      // only require tenant to be in env if a config is provided
      if (!process.env.TENANT) throw new Error('TENANT not defined in env');

      this.config[process.env.TENANT] = {
        ...config,
        collections: constructCollections(config.collections, process.env.TENANT),
      };
      this.tenants.push(process.env.TENANT);
    }
    // * tenants will be fetched from the app db if a tenant is not provided to the constructor
  }

  /**
   * Starts the Cristata server.
   */
  async start(): Promise<void> {
    await this.#connectDb();

    if (process.env.NODE_ENV === 'development') {
      console.clear();
      console.log(`\x1b[36mStarting the server...\x1b[0m`);
    }

    // when a request is made to the server, load the app
    this.server.on('request', (request, response) => {
      try {
        this.app(request, response);
      } catch (error) {
        response.destroy();
        console.error(error);
        this.logtail.error(JSON.stringify(replaceCircular(error)));
      }
    });

    // when the server starts,
    // create apollo graphql server middleware for each tenant
    this.server.on('listening', () => {
      try {
        this.tenants.forEach(async (tenant) => {
          if (this.config[tenant]) {
            // start apollo
            const apolloReturn = await apollo(this, tenant, this.tenants.length === 1);

            // throw error if apollo failed to start
            if (apolloReturn instanceof Error) throw apolloReturn;

            // otherwise, set the middleware and stop function for the tenant
            const [middleware, stopApollo] = apolloReturn;
            this.#apolloMiddleware[tenant] = middleware;
            this.#stopApollo[tenant] = stopApollo;
          }

          this.app.use((req, res, next) => {
            if (this.#apolloMiddleware[tenant]) this.#apolloMiddleware[tenant](req, res, next);
            else next();
          });
        });
      } catch (error) {
        console.error(error);
        this.logtail.error(JSON.stringify(replaceCircular(error)));
      }
    });

    // start the server
    try {
      this.server.listen(parseInt(process.env.PORT || ''), async () => {
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
            console.log(`To run tests, use \x1b[94mnpm run test\x1b[0m.`);
            console.log(``);
            console.log(`Type "rs" to manually restart the server.`);

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
              try {
                process.stdout.cursorTo(0);
                process.stdout.moveCursor(0, -1);
                process.stdout.clearLine(0);
                process.stdout.write(`\x1b[32mNo issues found.\x1b[0m\n`);
              } catch (error) {
                console.log(`\x1b[32mNo issues found.\x1b[0m\n`);
              }
            }
          } catch (error) {
            console.error(`Error linting:`, error);
            process.exit(1);
          }
        } else {
          console.log(`Cristata server listening on port ${process.env.PORT}!`);
        }

        // listen for tenant changes
        this.listenForConfigChange();
      });
    } catch (error) {
      console.error(`Failed to start Cristata  server on port ${process.env.PORT}!`, error);
      this.logtail.error(JSON.stringify(replaceCircular(error)));
    }
  }

  /**
   * Connect to the database and initialize mongoose.
   */
  async #connectDb(): Promise<void> {
    if (process.env.TENANT) await connectDb(process.env.TENANT);
    else {
      const appConn = await connectDb('app');

      if (process.env.NODE_ENV === 'development') {
        console.clear();
        console.log(`\x1b[36mCreating tenants...\x1b[0m`);
      }

      // get the tenants
      this.tenantsCollection = appConn.db.collection('tenants');
      const tenants = await this.tenantsCollection
        .find<{ _id: ObjectId; name: string; config: Configuration }>({})
        .toArray();

      tenants
        .filter((tenant) => !!tenant)
        .forEach(({ name, config }) => {
          // add each tenant to the config
          this.config[name] = { ...config, collections: constructCollections(config.collections, name) };
          this.tenants.push(name);
        });

      // check each tenant's subscription stats
      await this.#refreshTenantSubscriptionStatus();
    }

    if (process.env.NODE_ENV === 'development') {
      console.clear();
    }
  }

  /**
   * Gets the express app. Starts the app if it is not started.
   */
  get app(): Application {
    if (!this.#express) this.#express = createExpressApp(this);
    return this.#express;
  }

  /**
   * Check the subscription status of every tenant and store it in
   * `this.hasTenantPaid[tenant]`;
   *
   * This function creates an interval that runs every 15 minutes
   * and on initial function execution.
   */
  async #refreshTenantSubscriptionStatus() {
    if (process.env.NODE_ENV === 'development') {
      console.clear();
      console.log(`\x1b[36mChecking tenant subscription statuses...\x1b[0m`);
    }

    // check each tenant's subscription status
    const checkEachTenant = async () => {
      await Promise.all(
        this.tenants.map(async (tenant) => {
          try {
            const tenantDoc = await this.tenantsCollection?.findOne({ name: tenant });
            if (tenantDoc) {
              const hasPaid = tenantDoc.billing.subscription_active;
              const canAllowDiskUse = !!tenantDoc.billing.stripe_subscription_items?.allow_disk_use;
              this.hasTenantPaid[tenant] = hasPaid;
              this.canTenantAllowDiskUse[tenant] = canAllowDiskUse;
            }
          } catch (error) {
            console.error(error);
            this.logtail.error(JSON.stringify(replaceCircular(error)));
          }
        })
      );
    };

    // check on function execution and every subsequent 15 minutes
    await checkEachTenant();
    return setInterval(checkEachTenant, 1000 * 60 * 15);
  }

  /**
   * Hot reload/restart the Apollo GraphQL server for a specific tenant.
   *
   * _Returns an error if something went wrong._
   */
  async restartApollo(tenant: string): Promise<Error | void> {
    // attempt to create an updated apollo middleware with the newest configuration
    const apolloReturn = await apollo(this, tenant, this.tenants.length === 1);

    // if an error, return the error to the function that called this function
    // so it knows there was an issue
    if (apolloReturn instanceof Error) {
      return apolloReturn;
    }

    // otherwise, replace the old middleware and stop function with
    // the new version
    const [middleware, stopApollo] = apolloReturn;
    this.#apolloMiddleware[tenant] = middleware;
    this.#stopApollo[tenant] = stopApollo;
  }

  /**
   * Tests whether a tot reload/restart of the Apollo GraphQL server for a specific tenant will succeed or fail.
   *
   * _Returns an error if something went wrong._
   */
  async testNewConfig(tenant: string, config: Configuration): Promise<Error | void> {
    // attempt to create an updated apollo middleware with the newest configuration
    const apolloReturn = await apollo(
      { ...this, config: { [tenant]: config } },
      tenant,
      this.tenants.length === 1
    );

    // if an error, return the error to the function that called this function
    // so it knows there was an issue
    if (apolloReturn instanceof Error) {
      return apolloReturn;
    }
  }

  /**
   * Listens for when a tenant's configuration changes
   * and recreate apollo server and mongoose models
   * when needed.
   */
  async listenForConfigChange(): Promise<void> {
    this.tenantsCollection?.watch().on('change', async (data) => {
      if (
        hasChangeStreamNamespace<TenantsCollectionSchema>(data) &&
        data.ns.db === 'app' &&
        data.ns.coll === 'tenants' &&
        data.operationType === 'update'
      ) {
        const updatedFields = unflattenObject(data.updateDescription?.updatedFields || {}, '.');

        // handle when a config changes
        if (updatedFields?.config) {
          // get the updated doc
          // @ts-expect-error the type is wrong
          const newTenantDoc = await this.tenantsCollection.findOne({ _id: data.documentKey._id });

          if (newTenantDoc) {
            // update the config in the cristata instance
            this.config[newTenantDoc.name] = {
              ...newTenantDoc.config,
              collections: constructCollections(newTenantDoc.config.collections, newTenantDoc.name),
            };

            // restart apollo so it uses the newest config
            await this.restartApollo(newTenantDoc.name);
          }
        }
      }
    });
  }
}

// keep errors silent
process.on('unhandledRejection', (error) => console.error(error));

interface TenantsCollectionSchema {
  _id: ObjectId;
  name: string;
  config: Configuration;
  billing: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_active: boolean;
    subscription_last_payment?: string;
    stripe_subscription_items?: {
      core: { id: string; usage_reported_at: string };
      file_storage: { id: string; usage_reported_at: string };
      database_usage: { id: string; usage_reported_at: string };
      api_usage: { id: string; usage_reported_at: string };
      app_usage: { id: string; usage_reported_at: string };
      integrations: { id: string; usage_reported_at: string };
      allow_disk_use?: { id: string; usage_reported_at?: string };
    };
    metrics: {
      [key: number]:
        | {
            [key: number]:
              | {
                  [key: number]: { billable?: number; total: number } | undefined;
                }
              | undefined;
          }
        | undefined;
    };
  };
}

export default Cristata;
