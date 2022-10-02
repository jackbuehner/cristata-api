import { Hocuspocus } from '@hocuspocus/server';
import { Authenticate } from './Authenticate';
import { db } from './extension-db';

if (!process.env.SERVER_AUTH_URL) {
  throw new Error('SERVER_AUTH_URL is a required environment variable');
}

if (!process.env.SERVER_API_URL) {
  throw new Error('SERVER_API_URL is a required environment variable');
}

const authentication = new Authenticate({
  authHref: process.env.SERVER_AUTH_URL,
  apiEndpoint: process.env.SERVER_API_URL,
});

const hocuspocus = new Hocuspocus({
  extensions: [authentication, db],
  port: parseInt(process.env.PORT || '1234'),
});

hocuspocus.listen();
