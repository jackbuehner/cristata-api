import { Database } from '@hocuspocus/extension-database';
import { Extension } from '@hocuspocus/server';
import { afterLoadDocument } from './afterLoadDocument';
import { DB } from './DB';
import { fetch } from './fetch';
import { onDisconnect } from './onDisconnect';
import { store } from './store';

const tenantDb = new DB({
  username: process.env.MONGO_DB_USERNAME,
  password: process.env.MONGO_DB_PASSWORD,
  host: process.env.MONGO_DB_HOST,
});

export const db = new Database({
  fetch: fetch(tenantDb),
  store: store(tenantDb),
});

export const dbHelper: Extension = {
  afterLoadDocument: afterLoadDocument(tenantDb),
  onDisconnect: onDisconnect(tenantDb),
};
