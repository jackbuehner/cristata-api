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

export class HocuspocusMongoDB implements Extension {
  provider: MongodbPersistence;

  /**
   * Constructor
   */
  constructor() {
    this.provider = new MongodbPersistence(
      process.env.NODE_ENV === 'production'
        ? `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@editor0.htefm.mongodb.net/db_2?retryWrites=true&w=majority`
        : `mongodb://127.0.0.1:27017/?retryWrites=true&w=majority`,
      'hocuspocus'
    );
  }

  /**
   * onCreateDocument hook
   */
  async onCreateDocument(data: onCreateDocumentPayload): Promise<any> {
    const persistedDocument = await this.provider.getYDoc(data.documentName);
    const newUpdates = encodeStateAsUpdate(data.document);

    await this.store(data.documentName, newUpdates);
    applyUpdate(data.document, encodeStateAsUpdate(persistedDocument));

    // use the documents update handler directly instead of using the onChange hook
    // to skip the first change that's triggered by the applyUpdate above
    data.document.on('update', (update: Uint8Array) => {
      this.store(data.documentName, update);
    });
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
