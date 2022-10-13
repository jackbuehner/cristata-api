import { Forbidden, Unauthorized } from '@hocuspocus/common';
import { Extension, onConnectPayload, onLoadDocumentPayload, onUpgradePayload } from '@hocuspocus/server';
import { uncapitalize } from '@jackbuehner/cristata-utils';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import * as Y from 'yjs';
import { DB } from './extension-db/DB';

const tenantDb = new DB({
  username: process.env.MONGO_DB_USERNAME,
  password: process.env.MONGO_DB_PASSWORD,
  host: process.env.MONGO_DB_HOST,
});

export interface AuthenticateConfiguration {
  authHref: string;
  apiEndpoint: string;
}

class Authenticate implements Extension {
  configuration: AuthenticateConfiguration;
  timeout: Record<string, NodeJS.Timeout> = {};

  constructor(configuration: AuthenticateConfiguration) {
    this.configuration = configuration;
  }

  async onConnect({
    connection,
    requestHeaders,
    requestParameters,
    documentName,
  }: onConnectPayload): Promise<void> {
    const [tenant, collectionName, itemId] = documentName.split('.');

    // always start off as unauthenticated
    connection.requiresAuthentication = true;
    connection.isAuthenticated = false;

    // authenticate if AUTH_OVERRIDE_SECRET is provided
    if (
      process.env.AUTH_OVERRIDE_SECRET &&
      requestParameters.get('authSecret') === process.env.AUTH_OVERRIDE_SECRET
    ) {
      connection.isAuthenticated = true;
    }

    // confirm the document can be read and edited by the client
    if (!connection.isAuthenticated) {
      // check authentication status
      const authRes = await fetch(this.configuration.authHref, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          cookie: requestHeaders.cookie || '',
        },
      });

      if (authRes.status !== 200) {
        // prevent later hooks and default handler
        throw Unauthorized;
      }

      if (requestParameters.get('_id') !== (await authRes.json())._id) {
        throw new Error('_id does not match');
      }

      // get the collection accessor
      const by = await tenantDb.collectionAccessor(tenant, collectionName);

      // get the object id of the doc
      let _id = itemId;
      if (by.one[1] !== 'ObjectId' || by.one[0] !== '_id') {
        const dbDoc = await tenantDb
          .collection(tenant, collectionName)
          ?.findOne(
            { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
            { projection: { _id: 1 } }
          );
        if (dbDoc) _id = dbDoc._id.toHexString();
        else throw new Error('failed to get _id for read/write access');
      }

      // check read/write access
      const accessRes = await fetch(`${this.configuration.apiEndpoint}/${tenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: requestHeaders.cookie || '' },
        body: JSON.stringify({
          query: `
            query GetAccess($_id: ObjectID) {
              ${uncapitalize(collectionName)}ActionAccess(_id: $_id) {
                get
                modify
              }
            }
          `,
          variables: { _id: _id },
        }),
      });

      if (!accessRes.ok) {
        throw new Error('failed to query for read/write access');
      }

      const json = await accessRes.json();
      const access = json?.data?.[`${uncapitalize(collectionName)}ActionAccess`];
      if (access?.get && access?.modify) {
        connection.isAuthenticated = true;
      } else {
        // prevent later hooks and default handler
        throw Forbidden;
      }
    }
  }

  async afterLoadDocument(data: onLoadDocumentPayload): Promise<void> {
    const ydoc = data.document;

    // get the shared types for the permissions
    const users = ydoc.getArray('permissions.users');
    const teams = ydoc.getArray('permissions.teams');

    // we should disconnect everyone whenever a user or team
    // is removed from the permissions array
    // (clients will reconnect within a few seconds if
    // they still have access)
    let deletedSize: number | undefined = undefined;
    const disconnect = (evt: Y.YArrayEvent<unknown>) => {
      deletedSize = (deletedSize || 0) + evt.changes.deleted.size;
      data.instance.debounce('permissionDeleted', () => {
        if ((deletedSize || 0) > 0) {
          data.instance.closeConnections(data.documentName);
          deletedSize = 0;
        }
      });
    };

    users.observe(disconnect);
    teams.observe(disconnect);
  }

  async onUpgrade(data: onUpgradePayload): Promise<void> {
    setTimeout(() => {
      // disconnect every 60 minutes
      data.socket.destroy();
    }, 60 * 60 * 1000);
  }
}

export { Authenticate };
