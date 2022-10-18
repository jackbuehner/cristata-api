import { fetchPayload } from '@hocuspocus/server';
import mongoose from 'mongoose';
import * as Y from 'yjs';
import { base64ToUint8 } from '../utils';
import { DB } from './DB';

export function fetch(tenantDb: DB) {
  return async ({ documentName, context }: fetchPayload): Promise<Uint8Array | null> => {
    const [tenant, collectionName, itemId] = documentName.split('.');

    // get the collection
    const collection = tenantDb.collection(tenant, collectionName);
    if (!collection) {
      throw new Error(`Collection for document '${documentName}' was not found in the database`);
    }

    // get the collection accessor
    const by = await tenantDb.collectionAccessor(tenant, collectionName);

    // get database document
    const dbDoc = await tenantDb
      .collection(tenant, collectionName)
      ?.findOne(
        { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
        { projection: { __yState: 1 } }
      );

    // throw an error if the document was not found
    if (!dbDoc) {
      throw new Error(`Document '${documentName}' was not found in the database`);
    }

    // if the database document was found and it contains an encoded ydoc state,
    // create a ydoc based on the version in the database
    if (dbDoc?.__yState !== undefined) {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, base64ToUint8(dbDoc.__yState)); // insert current encoded state into doc
      return Y.encodeStateAsUpdate(ydoc);
    }

    // otherwise, we can create a new ydoc
    const ydoc = new Y.Doc();
    context.shouldInjectDataToDoc = true;

    // hocuspocus requires the doc as a Uint8Array
    return Y.encodeStateAsUpdate(ydoc);
  };
}
