import compression from 'compression';
import cookieSession from 'cookie-session';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import { NextFunction } from 'express-serve-static-core';
import helmet from 'helmet';
import passport from 'passport';
import Stripe from 'stripe';
import Cristata from '../Cristata';
import { calcS3Storage } from '../graphql/resolvers/billing';
import { TenantDB } from '../mongodb/TenantDB';
import { connectDb } from '../mongodb/connectDB';
import { IUser } from '../mongodb/users';
import { corsConfig } from './middleware/cors';
import { requireAuth } from './middleware/requireAuth';
import { unless } from './middleware/unless';
import './passport';
import { IDeserializedUser } from './passport';
import { authRouterFactory } from './routes/auth.route';
import { heapRouterFactory } from './routes/heap.route';
import { proxyRouterFactory } from './routes/proxy.route';
import { releaseRouterFactory } from './routes/release.route';
import { rootRouter } from './routes/root.route';
import { stripeRouterFactory } from './routes/stripe.route';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2020-08-27' });

// load environmental variables
dotenv.config({ override: true });

function createExpressApp(cristata: Cristata): Application {
  // create express app
  const app = express();

  // use URL search params for query variable
  app.set('query parser', (queryString: string) => {
    return new URLSearchParams(queryString);
  });

  // inject cristata instance into request object
  app.use((req, res, next) => {
    req.cristata = cristata;
    next();
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

  // update user last active timestamp
  app.use(updateUserTimestamp);

  // track number of requests for billing purposes
  app.use(trackRequests);

  // parse incoming request body
  app.use(unless('/stripe/webhook', express.json({ limit: '500kb' })));
  app.use(express.urlencoded({ extended: true }));

  // pretty print sent json
  app.set('json spaces', 2);

  // assume that the proxy to the express server is secure
  app.set('trust proxy', 1); // trust first proxy

  // store session in the client cookie
  app.use(
    cookieSession({
      name: process.env.NODE_ENV === 'production' ? '__Secure-cristata-session' : 'cristata-session',
      secret: process.env.COOKIE_SESSION_SECRET,
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' || !process.env.GITPOD_WORKSPACE_URL ? 'strict' : 'none',
      secure: process.env.NODE_ENV === 'production' || !!process.env.GITPOD_WORKSPACE_URL,
      domain: process.env.NODE_ENV === 'production' ? '.cristata.app' : undefined,
    })
  );

  // use text compression for responses
  app.use(compression());

  // initialize passport
  app.use(passport.initialize({ userProperty: 'user' }));
  app.use(passport.session()); // replace `req.user` with passport user

  // connect routers to app
  app.use(`/auth`, authRouterFactory(cristata)); // authentication routes
  app.use(proxyRouterFactory()); // CORS proxy routes
  app.use(`/releases`, releaseRouterFactory()); // app release routes
  app.use(stripeRouterFactory(cristata)); // stripe routes
  app.use(`/heap`, heapRouterFactory()); // heap/memory routes
  app.use(``, rootRouter); // root v3 routes

  app.get(``, requireAuth, (req: Request, res: Response) => {
    res.send(`Cristata API Server`);
  });

  function updateDatabaseUsageMetric() {
    try {
      const tenants = cristata.tenants;

      tenants
        .filter((tenant) => !!tenant)
        .forEach(async (tenant) => {
          const conn = await connectDb(tenant);
          const tenantDbStats = await conn.db.stats();
          const tenantDbSizeGb = tenantDbStats.dataSize / 1000000000;

          // get the tenant document
          const tenantDoc = await cristata.tenantsCollection?.findOne({ name: tenant });

          // update usage in stripe
          if (tenantDoc?.billing.stripe_subscription_items?.database_usage.id) {
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
          await cristata.tenantsCollection?.updateOne(
            { name: tenant },
            {
              $set: {
                'billing.stripe_subscription_items.database_usage.usage_reported_at': new Date().toISOString(),
              },
            }
          );
        });
    } catch (error) {
      console.error('Error setting database usage metric in Stripe');
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
          const tenantDoc = await cristata.tenantsCollection?.findOne({ name: tenant });

          // calculate the current s3 size
          const bucket = tenant === 'paladin-news' ? 'paladin-photo-library' : `app.cristata.${tenant}.photos`;
          const s3Size = await calcS3Storage(bucket, {
            accessKeyId: process.env.AWS_SECRET_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          });
          const s3SizeGb = s3Size / 1000000000;

          // update usage in stripe
          if (tenantDoc?.billing.stripe_subscription_items?.file_storage?.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc?.billing.stripe_subscription_items.file_storage.id,
              {
                quantity: Math.ceil(s3SizeGb),
                action: 'set',
                timestamp: 'now',
              }
            );
          }

          // update timestamp in the database
          await cristata.tenantsCollection?.updateOne(
            { name: tenant },
            {
              $set: {
                'billing.stripe_subscription_items.file_storage.usage_reported_at': new Date().toISOString(),
              },
            }
          );
        });
    } catch (error) {
      console.error('Error setting storage usage metric in Stripe');
      console.error(error);
    }
  }

  const appUsageCountQueue: Record<string, number | undefined> = {};
  const apiUsageCountQueue: Record<string, number | undefined> = {};
  function updateAppApiUsageMetric() {
    try {
      const tenants = cristata.tenants;

      const year = new Date().getUTCFullYear();
      const month = new Date().getUTCMonth() + 1; // start at 1
      const day = new Date().getUTCDate();

      tenants
        .filter((tenant) => !!tenant)
        .forEach(async (tenant) => {
          // copy the queue
          const appUsage = appUsageCountQueue[tenant] || 0;
          const apiUsage = apiUsageCountQueue[tenant] || 0;

          // reset the queue
          appUsageCountQueue[tenant] = 0;
          apiUsageCountQueue[tenant] = 0;

          // get the tenant document
          const tenantDoc = await cristata.tenantsCollection?.findOne({ name: tenant });

          // update usage in stripe
          if (tenantDoc?.billing.stripe_subscription_items?.app_usage?.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc.billing.stripe_subscription_items.app_usage.id,
              {
                quantity: appUsage,
                action: 'increment',
                timestamp: 'now',
              }
            );
          }
          if (tenantDoc?.billing.stripe_subscription_items?.api_usage?.id) {
            await stripe.subscriptionItems.createUsageRecord(
              tenantDoc.billing.stripe_subscription_items.api_usage.id,
              {
                quantity: apiUsage,
                action: 'increment',
                timestamp: 'now',
              }
            );
          }

          // update usage in the database
          await cristata.tenantsCollection?.updateOne(
            { name: tenant },
            {
              $inc: {
                [`billing.metrics.${year}.${month}.${day}.total`]: appUsage,
                [`billing.metrics.${year}.${month}.${day}.billable`]: apiUsage,
              },
              $set: {
                'billing.stripe_subscription_items.app_usage.usage_reported_at': new Date().toISOString(),
                'billing.stripe_subscription_items.api_usage.usage_reported_at': new Date().toISOString(),
              },
            }
          );
        });
    } catch (error) {
      console.error('Error setting API/app usage metric in Stripe');
      console.error(error);
    }
  }

  // update database usage metric in stripe every 15 minutes and on server start
  updateDatabaseUsageMetric();
  setInterval(updateDatabaseUsageMetric, 1000 * 60 * 15);

  // update storage usage metric in stripe every 15 minutes and on server start
  updateStorageUsageMetric();
  setInterval(updateStorageUsageMetric, 1000 * 60 * 15);

  // update app and api usage metric in stripe and teh database every 1 minute and on server start
  updateAppApiUsageMetric();
  setInterval(updateAppApiUsageMetric, 100 * 60);

  // end external requests if the tenant does not have an active subscription
  // or the tenant does not exist
  // ! this must be the last middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = calcTenant(req);
      if (tenant) {
        const hasPaid = cristata.hasTenantPaid[tenant];
        if (isInternalUse(req)) next();
        else if (hasPaid) next();
        else res.status(402).end();
      } else {
        res.status(404).end(); // tenant does not exist; send 404 error
      }
    } catch (error) {
      console.error(error);
    }
  });

  // return the app
  return app;

  function updateUserTimestamp(req: Request, res: Response, next: NextFunction) {
    req.on('end', async () => {
      try {
        if (req.isAuthenticated()) {
          const tenantDB = new TenantDB((req.user as IDeserializedUser).tenant);
          await tenantDB.connect();
          const Users = await tenantDB.model<IUser>('User');

          const user = await Users?.findById((req.user as IDeserializedUser)._id, null);
          if (user) {
            const now = new Date();
            if (new Date(user.timestamps.last_active_at).valueOf() < now.valueOf() - 15000) {
              // only update if time is more than 15 seconds away
              user.timestamps.last_active_at = now.toISOString();
            }
            user.save();
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
    next();
  }

  function calcTenant(req: Request) {
    const path = new URL(req.url, `http://${req.headers.host}`).pathname.replace('/v3/', '');
    const tenant = path.match(/(.*?)\//)?.[0] || path;
    if (cristata.tenants.includes(tenant)) return tenant;
    return null;
  }

  function isInternalUse(req: Request) {
    const originHostname = (() => {
      try {
        if (req.headers.origin) return new URL(req.headers.origin).hostname;
        return 'SERVER_SIDE_REQUEST';
      } catch {
        return 'SERVER_SIDE_REQUEST';
      }
    })();
    const internalDomain = 'cristata.app';
    const isInternal = originHostname.indexOf(internalDomain) === originHostname.length - internalDomain.length;
    return isInternal || process.env.NODE_ENV === 'development';
  }

  function trackRequests(req: Request, res: Response, next: NextFunction) {
    req.on('end', async () => {
      try {
        const tenant = calcTenant(req);
        const responseWasSuccessful = res.statusCode >= 200 && res.statusCode < 300;

        if (tenant && responseWasSuccessful) {
          appUsageCountQueue[tenant] = (appUsageCountQueue[tenant] || 0) + 1;

          // for external usage, also count it towards billable api usage
          if (!isInternalUse(req) && process.env.NODE_ENV !== 'development') {
            apiUsageCountQueue[tenant] = (apiUsageCountQueue[tenant] || 0) + 1;
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
    next();
  }
}

export { createExpressApp };
