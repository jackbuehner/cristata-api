import { Hocuspocus } from '@hocuspocus/server';
import { Authenticate } from './Authenticate';
import { db } from './extension-db';

const authentication = new Authenticate({
  authHref: process.env.SERVER_AUTH_URL || '',
});

const hocuspocus = new Hocuspocus({
  extensions: [authentication, db],
  port: 1234,
});

hocuspocus.listen();
