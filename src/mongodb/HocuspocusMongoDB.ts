/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Extension,
  onChangePayload,
  onConfigurePayload,
  onConnectPayload,
  onCreateDocumentPayload,
  onDestroyPayload,
  onDisconnectPayload,
  onListenPayload,
  onRequestPayload,
  onUpgradePayload,
} from '@hocuspocus/server';

import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { MongodbPersistence } from 'y-mongodb';
import { Configuration } from '../types/config';

export class HocuspocusMongoDB implements Extension {
  provider: MongodbPersistence;

  /**
   * Constructor
   */
  constructor(config: Configuration) {
    // destructure connection info from config
    const { username, password, host, database, options } = config.connection;

    // set the provider database and collection
    this.provider = new MongodbPersistence(
      `mongodb+srv://${username}:${password}@${host}/${database}?${options}`,
      'hocuspocus'
    );
  }

  /**
   * onCreateDocument hook
   */
  async onCreateDocument(data: onCreateDocumentPayload): Promise<any> {
    // remove server path from document name
    if (process.env.TENANT) {
      data.documentName = data.documentName.replace(`${process.env.TENANT}/`, '');
    }

    const persistedDocument = await this.provider.getYDoc(data.documentName);
    const newUpdates = encodeStateAsUpdate(data.document);

    await this.store(data.documentName, newUpdates);
    applyUpdate(data.document, encodeStateAsUpdate(persistedDocument));

    // force the document to update once the newUpdates and persistedDocument
    // are merged together
    const map = data.document.getMap('__forceUpdate');
    const counter = map.get('couter') || 0;
    map.set('counter', counter + 1);

    // use the documents update handler directly instead of using the onChange hook
    // to skip the first change that's triggered by the applyUpdate above
    data.document.on('update', (update: Uint8Array) => {
      this.store(data.documentName, update);
    });
  }

  /**
   * Check equality of two ArrayBuffers
   */
  areArrayBuffersEqual(first: Uint8Array, second: Uint8Array): boolean {
    return first.length === second.length && first.every((value, index) => value === second[index]);
  }

  /**
   * store updates in y-leveldb persistence
   */
  async store(documentName: string, update: Uint8Array): Promise<any> {
    return this.provider.storeUpdate(documentName, update);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onChange(data: onChangePayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onConnect(data: onConnectPayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onDisconnect(data: onDisconnectPayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onListen(data: onListenPayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onDestroy(data: onDestroyPayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onConfigure(data: onConfigurePayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onRequest(data: onRequestPayload) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
  async onUpgrade(data: onUpgradePayload) {}
}
