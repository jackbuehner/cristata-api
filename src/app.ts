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
  app.use(async (req, res, next) => {
    try {
      if (req.isAuthenticated()) {
        const tenantDB = mongoose.connection.useDb((req.user as IDeserializedUser).tenant, { useCache: true });
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
    next();
  });

  // track number of requests for billing purposes
  app.use(async (req, res, next) => {
    try {
      const tenant: string | null = (() => {
        const path = new URL(req.url, `http://${req.headers.host}`).pathname.replace('/v3/', '');
        const tenant = path.match(/(.*?)\//)?.[0] || path;
        if (cristata.tenants.includes(tenant)) return tenant;
        return null;
      })();

      if (tenant) {
        const year = new Date().getUTCFullYear();
        const month = new Date().getUTCMonth() + 1; // start at 1
        const day = new Date().getUTCDate();

        if (req.hostname === 'cristata.app' || process.env.NODE_ENV === 'development') {
          await cristata.tenantsCollection.findOneAndUpdate(
            { name: tenant },
            { $inc: { [`billing.metrics.${year}.${month}.${day}.total`]: 1 } }
          );
        } else {
          await cristata.tenantsCollection.findOneAndUpdate(
            { name: tenant },
            {
              $inc: {
                [`billing.metrics.${year}.${month}.${day}.billable`]: 1,
                [`billing.metrics.${year}.${month}.${day}.total`]: 1,
              },
            }
          );
        }
      }
    } catch (error) {
      console.error(error);
    }
    next();
  });

  // return the app
  return app;
}

export { createExpressApp };
