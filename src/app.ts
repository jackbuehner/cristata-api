import compression from 'compression';
import cookieSession from 'cookie-session';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import passport from 'passport';
import { apiRouter3 } from './api/v3/routes';
import { authRouter } from './auth.route';
import Cristata from './Cristata';
import { corsConfig } from './middleware/cors';
import { requireAuth } from './middleware/requireAuth';
import { IUser } from './mongodb/users';
import './passport';
import { IDeserializedUser } from './passport';
import { proxyRouterFactory } from './proxy.route';
import { unless } from './middleware/unless';
import { stripeRouterFactory } from './stripe.route';
import Stripe from 'stripe';
import { NextFunction } from 'express-serve-static-core';
import { calcS3Storage } from './api/v3/resolvers/billing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-08-27' });

// load environmental variables
dotenv.config();

function createExpressApp(cristata: Cristata): Application {
  // create express app
  const app = express();

  // use URL search params for query variable
  app.set('query parser', (queryString: string) => {
    return new URLSearchParams(queryString);
  });

  // secure app with helmet
  app.use(
    helmet({
      // only allow self and resources required for graphql playground
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`, 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
          fontSrc: [`'self'`, 'fonts.gstatic.com'],
          imgSrc: [`'self'`, 'data:', 'cdn.jsdelivr.net'],
          scriptSrc: [`'self'`, `https: 'unsafe-inline'`, `cdn.jsdelivr.net`],
        },
      },
      // sets "Cross-Origin-Embedder-Policy: require-corp"
      // to prevent documents from loading cross-origin resources that do not
      // explicitly grant permission
      crossOriginEmbedderPolicy: true,
      // sets "Cross-Origin-Opener-Policy: same-origin" to ensure that top-level
      // documents do not share a browsing context group with cross-origin
      // documents
      crossOriginOpenerPolicy: true,
      // sets "Cross-Origin-Resource-Policy: same-site"
      crossOriginResourcePolicy: {
        policy: 'same-site',
      },
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

  // enable CORS for the app
  app.use(cors(corsConfig()));

  // parse incoming request body
  app.use(unless('/stripe/webhook', express.json()));
  app.use(express.urlencoded({ extended: true }));

  // pretty print sent json
  app.set('json spaces', 2);

  // assume that the proxy to the express server is secure
  app.set('trust proxy', 1); // trust first proxy

  // store session in the client cookie
  app.use(
    cookieSession({
      name: '__Host-cristata-session',
      secret: process.env.COOKIE_SESSION_SECRET,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'none',
      secure: true,
    })
  );

  // use text compression for responses
  app.use(compression());

  // initialize passport
  app.use(passport.initialize({ userProperty: 'user' }));
  app.use(passport.session()); // replace `req.user` with passport user

  // connect routers to app
  app.use(`/auth`, authRouter); // authentication routes
  app.use(`/v3`, apiRouter3); // API v3 routes
  app.use(proxyRouterFactory()); // CORS proxy routes
  app.use(stripeRouterFactory(cristata)); // stripe routes

  app.get(``, requireAuth, (req: Request, res: Response) => {
    res.send(`Cristata API Server`);
  });

  // update user last active timestamp
  app.use((req, res, next) => {
    req.on('end', async () => {
      try {
        if (req.isAuthenticated()) {
          const tenantDB = mongoose.connection.useDb((req.user as IDeserializedUser).tenant, {
            useCache: true,
          });
          const user = await tenantDB.model<IUser>('User').findById((req.user as IDeserializedUser)._id, null);
          const now = new Date();
          if (new Date(user.timestamps.last_active_at).valueOf() < now.valueOf() - 15000) {
            // only update if time is more than 15 seconds away
            user.timestamps.last_active_at = now.toISOString();
          }
          user.save();
        }
      } catch (error) {
        console.error(error);
      }
    });
    next();
  });

  function calcTenant(req: Request) {
    const path = new URL(req.url, `http://${req.headers.host}`).pathname.replace('/v3/', '');
    const tenant = path.match(/(.*?)\//)?.[0] || path;
    if (cristata.tenants.includes(tenant)) return tenant;
    return null;
  }

  function isInternalUse(req: Request) {
    const originHostname = (() => {
      try {
        return new URL(req.headers.origin).hostname;
      } catch {
        return 'SERVER_SIDE_REQUEST';
      }
    })();
    const internalDomain = 'cristata.app';
    const isInternal = originHostname.indexOf(internalDomain) === originHostname.length - internalDomain.length;
    return isInternal || process.env.NODE_ENV === 'development';
  }

  // track number of requests for billing purposes
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    req.on('end', async () => {
      try {
        const tenant = calcTenant(req);
        const responseWasSuccessful = res.statusCode >= 200 && res.statusCode < 300;

        if (tenant && responseWasSuccessful) {
          const year = new Date().getUTCFullYear();
          const month = new Date().getUTCMonth() + 1; // start at 1
          const day = new Date().getUTCDate();

          // get the tenant document
          const tenantDoc = await cristata.tenantsCollection.findOne({ name: tenant });

          // update usage in stripe
          if (tenantDoc.billing.stripe_subscription_items?.app_usage?.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc.billing.stripe_subscription_items.app_usage.id,
              {
                quantity: 1,
                action: 'increment',
                timestamp: 'now',
              }
            );
          }

          // update usage in the database
          await cristata.tenantsCollection.findOneAndUpdate(
            { name: tenant },
            {
              $inc: { [`billing.metrics.${year}.${month}.${day}.total`]: 1 },
              $set: {
                'billing.stripe_subscription_items.app_usage.usage_reported_at': new Date().toISOString(),
              },
            }
          );

          // for external usage, also count it towards billable api usage
          if (!isInternalUse(req) && process.env.NODE_ENV !== 'development') {
            {
              // update usage in stripe
              if (tenantDoc.billing.stripe_subscription_items?.api_usage?.id) {
                await stripe.subscriptionItems.createUsageRecord(
                  tenantDoc.billing.stripe_subscription_items.api_usage.id,
                  {
                    quantity: 1,
                    action: 'increment',
                    timestamp: 'now',
                  }
                );
              }

              // update usage in the database
              await cristata.tenantsCollection.updateOne(
                { name: tenant },
                {
                  $inc: {
                    [`billing.metrics.${year}.${month}.${day}.billable`]: 1,
                  },
                  $set: {
                    'billing.stripe_subscription_items.api_usage.usage_reported_at': new Date().toISOString(),
                  },
                }
              );
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
    next();
  });

  function updateDatabaseUsageMetric() {
    try {
      const tenants = cristata.tenants;

      tenants
        .filter((tenant) => !!tenant)
        .forEach(async (tenant) => {
          const tenantDb = mongoose.connection.useDb(tenant, { useCache: true });
          const tenantDbStats = await tenantDb.db.stats();
          const tenantDbSizeGb = tenantDbStats.dataSize / 1000000000;

          // get the tenant document
          const tenantDoc = await cristata.tenantsCollection.findOne({ name: tenant });

          // update usage in stripe
          if (tenantDoc.billing.stripe_subscription_items?.database_usage.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc.billing.stripe_subscription_items.database_usage.id,
              {
                quantity: Math.ceil(tenantDbSizeGb),
                action: 'set',
                timestamp: 'now',
              }
            );
          }

          // update timestamp in the database
          await cristata.tenantsCollection.updateOne(
            { name: tenant },
            {
              $set: {
                'billing.stripe_subscription_items.database_usage.usage_reported_at': new Date().toISOString(),
              },
            }
          );
        });
    } catch (error) {
      console.error(error);
    }
  }

  function updateStorageUsageMetric() {
    try {
      const tenants = cristata.tenants;

      tenants
        .filter((tenant) => !!tenant)
        .forEach(async (tenant) => {
          // get the tenant document
          const tenantDoc = await cristata.tenantsCollection.findOne({ name: tenant });

          // calculate the current s3 size
          const s3Size = await calcS3Storage('paladin-photo-library', tenantDoc.config.secrets.aws);
          const s3SizeGb = s3Size / 1000000000;

          // update usage in stripe
          if (tenantDoc.billing.stripe_subscription_items?.file_storage.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc.billing.stripe_subscription_items.file_storage.id,
              {
                quantity: Math.ceil(s3SizeGb),
                action: 'set',
                timestamp: 'now',
              }
            );
          }

          // update timestamp in the database
          await cristata.tenantsCollection.updateOne(
            { name: tenant },
            {
              $set: {
                'billing.stripe_subscription_items.file_storage.usage_reported_at': new Date().toISOString(),
              },
            }
          );
        });
    } catch (error) {
      console.error(error);
    }
  }

  // update database usage metric in stripe every 15 minutes and on server start
  updateDatabaseUsageMetric();
  setInterval(updateDatabaseUsageMetric, 1000 * 60 * 15);

  // update storage usage metric in stripe every 15 minutes and on server start
  updateStorageUsageMetric();
  setInterval(updateStorageUsageMetric, 1000 * 60 * 15);

  // end external requests if the tenant does not have an active subscription
  // ! this must be the last middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = calcTenant(req);
      if (tenant) {
        const hasPaid = cristata.hasTenantPaid[tenant];
        if (isInternalUse(req)) next();
        else if (hasPaid) next();
        else res.status(402).end();
      }
    } catch (error) {
      console.error(error);
    }
  });

  // return the app
  return app;
}

export { createExpressApp };
