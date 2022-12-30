import { Hocuspocus } from '@hocuspocus/server';
import dotenv from 'dotenv';
import { Authenticate } from './Authenticate';
import { db, dbHelper } from './extension-db';

dotenv.config({ override: true });

if (!process.env.SERVER_AUTH_URL) throw new Error('SERVER_AUTH_URL is a required environment variable');
if (!process.env.SERVER_API_URL) throw new Error('SERVER_API_URL is a required environment variable');
if (!process.env.AWS_SECRET_KEY_ID) throw new Error('AWS_SECRET_KEY_ID is a required environment variable');
if (!process.env.AWS_SECRET_ACCESS_KEY)
  throw new Error('AWS_SECRET_ACCESS_KEY is a required environment variable');

const authentication = new Authenticate({
  authHref: process.env.SERVER_AUTH_URL,
  apiEndpoint: process.env.SERVER_API_URL,
});

const hocuspocus = new Hocuspocus({
  extensions: [authentication, db, dbHelper],
  port: parseInt(process.env.PORT || '1234'),
  address: process.env.HOST || '127.0.0.1',
});

hocuspocus.listen();
