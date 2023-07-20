import { Forbidden, Unauthorized } from '@hocuspocus/common';
import { Extension, onConnectPayload, onLoadDocumentPayload, onUpgradePayload } from '@hocuspocus/server';
import { uncapitalize } from '@jackbuehner/cristata-utils';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import semver from 'semver';
import * as Y from 'yjs';
import { DB } from './extension-db/DB';
import { parseName } from './utils';

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

    // throw if connection to database is not ready
    if (tenantDb.readyState !== 1) throw 'not ready';

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

    if (!connection.isAuthenticated) {
      const appVersion = requestParameters.get('appVersion');
      const appVersionRequirement = process.env.APP_VERSION_REQUIREMENT || '=0.0.0';
      if (!appVersion) throw Forbidden;
      if (!semver.satisfies(appVersion, appVersionRequirement)) {
        throw Forbidden;
      }
    }

    // confirm the document can be read and edited by the client
    if (!connection.isAuthenticated) {
      // check authentication status
      const authUser = await fetch(this.configuration.authHref, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          cookie: requestHeaders.cookie || '',
        },
      })
        .then(async (res) => {
          if (res.status !== 200) {
            // prevent later hooks and default handler
            throw Unauthorized;
          }
          return (await res.json()) as Record<string, unknown>;
        })
        .catch(() => {
          throw Unauthorized;
        });

      if (requestParameters.get('_id') !== authUser._id) {
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
      const access = await fetch(`${this.configuration.apiEndpoint}/${tenant}`, {
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
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error('failed to query for read/write access');
          }
          return (await res.json())?.data?.[`${uncapitalize(collectionName)}ActionAccess`] as
            | Record<string, boolean | undefined>
            | undefined;
        })
        .catch(() => {
          throw Unauthorized;
        });

      if (access?.get && access?.modify) {
        connection.isAuthenticated = true;
      } else {
        // prevent later hooks and default handler
        throw Forbidden;
      }

      // get the options for the collection
      const options = await tenantDb.collectionOptions(tenant, collectionName);

      // disable writing when doc is hidden, archived, locked
      // unless connecting from the server
      if (
        process.env.AUTH_OVERRIDE_SECRET &&
        requestParameters.get('authSecret') !== process.env.AUTH_OVERRIDE_SECRET
      ) {
        await tenantDb
          .collection(tenant, collectionName)
          ?.findOne(
            { _id: new mongoose.Types.ObjectId(_id) },
            { projection: { hidden: 1, archived: 1, locked: 1, stage: 1 } }
          )
          .then((res) => {
            if (!res) throw new Error(`failed to get readonly info`);

            const { hidden, archived, locked, stage } = res;

            if (hidden || archived || locked) {
              connection.readOnly = true;
            }

            if (options?.independentPublishedDocCopy && stage == 5.2) {
              connection.readOnly = true;
            }
          })
          .catch((error) => {
            throw new Error(`failed to get readonly info: ${error}`);
          });
      }
    }
  }

  async afterLoadDocument(data: onLoadDocumentPayload): Promise<void> {
    const ydoc = data.document;
    const { tenant, collectionName } = parseName(data.documentName);

    // get the options for the collection
    const options = await tenantDb.collectionOptions(tenant, collectionName);

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

    // disconnect if hidden, archived, or locked change
    // to force clients to reconnect in read-only mode
    // when any of them are true or with read-only mode
    // turned off when all of the conditions are false
    const checkboxes = ydoc.getMap<Record<string, boolean | undefined | null>>('__checkboxes');
    const checkboxDisconnect = (evt: Y.YMapEvent<Record<string, boolean | null | undefined>>) => {
      evt.changes.keys.forEach((value, key) => {
        if (key === 'hidden' || key === 'archived' || key === 'locked') {
          data.instance.closeConnections(data.documentName);
        }
      });
    };

    // disconnect if stage is published and __publishedCopy is enabled
    // because editing the unpublished copy is disabled when stage is 5.2
    // (client should use the collectionModify query to lower the stage)
    const stage = ydoc.getArray<{ value: string; label: string }>('stage');
    const stageDisconnect = (evt: Y.YArrayEvent<{ value: string; label: string }>) => {
      const stage = evt.target.toArray()?.[0]?.value;
      if (options?.independentPublishedDocCopy && `${stage}` === '5.2') {
        data.instance.closeConnections(data.documentName);
      }
    };

    users.observe(disconnect);
    teams.observe(disconnect);
    checkboxes.observe(checkboxDisconnect);
    stage.observe(stageDisconnect);
  }

  // async onChange({
  //   document: ydoc,
  //   documentName,
  //   instance,
  //   requestParameters,
  // }: onChangePayload): Promise<void> {
  //   const { tenant, collectionName } = parseName(documentName);

  //   // disconnect the client on certain conditions if it is not the server
  //   // so that it reconnects after disconnect with update auth settings (e.g. readOnly mode)
  //   if (
  //     process.env.AUTH_OVERRIDE_SECRET &&
  //     requestParameters.get('authSecret') !== process.env.AUTH_OVERRIDE_SECRET
  //   ) {
  //     // get the collection
  //     const collection = tenantDb.collection(tenant, collectionName);
  //     if (!collection) {
  //       console.error('[INVALID COLLECTION] FAILED TO SAVE YDOC WITH VALUES:', ydoc.toJSON());
  //       throw new Error(`Document '${documentName}' was not found in the database`);
  //     }

  //     // get the collection schema
  //     const schema = await tenantDb.collectionSchema(tenant, collectionName);
  //     const deconstructedSchema = deconstructSchema(schema || {});

  //     // get the options for the collection
  //     const options = await tenantDb.collectionOptions(tenant, collectionName);

  //     // get the values of the ydoc shared types
  //     // (to be used for setting database document values)
  //     const docData =
  //       (await getFromY(ydoc, deconstructedSchema, {
  //         keepJsonParsed: true,
  //         hexIdsAsObjectIds: true,
  //         replaceUndefinedNull: true,
  //         collectionName: collectionName + 'auth+change',
  //       })) || {};
  //     const { hidden, archived, locked, stage } = docData;

  //     // disconnect if hidden, archived, or locked are true
  //     // to force clients to reconnect in read-only mode
  //     if (hidden || archived || locked) {
  //       instance.closeConnections(documentName);
  //     }

  //     // disconnect if stage is published and __publishedCopy is enabled
  //     // because editing the unpublished copy is disabled when stage is 5.2
  //     // (client should use the collectionModify query to lower the stage)
  //     if (options?.independentPublishedDocCopy && stage == 5.2) {
  //       instance.closeConnections(documentName);
  //     }
  //   }
  // }

  async onUpgrade(data: onUpgradePayload): Promise<void> {
    setTimeout(() => {
      // disconnect every 60 minutes
      data.socket.destroy();
    }, 60 * 60 * 1000);
  }
}

export { Authenticate };
