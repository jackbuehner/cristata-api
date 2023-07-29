import { fetchPayload } from '@hocuspocus/server';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import * as Y from 'yjs';
import { base64ToUint8, parseName } from '../utils';
import { CollectionDoc, DB } from './DB';

export function fetch(tenantDb: DB) {
  return async ({ documentName, context }: fetchPayload): Promise<Uint8Array | null> => {
    const { tenant, collectionName, version } = parseName(documentName);

    // throw if connection to database is not ready
    if (tenantDb.readyState !== 1) throw 'not ready';

    // get the collection
    const collection = tenantDb.collection(tenant, collectionName);
    if (!collection) {
      throw new Error(`Collection for document '${documentName}' was not found in the database`);
    }

    // get the collection accessor
    const by = await tenantDb.collectionAccessor(tenant, collectionName);

    // handle special behavior for viewing previous versions
    if (version) return findOldVersionYdoc({ tenantDb, documentName, context, collection, by });

    // deserialize the ydoc state from the database or create a new ydoc
    return findOrCreateYdoc({ tenantDb, documentName, context, collection, by });
  };
}

interface FindOrCreateYDocParams {
  tenantDb: DB;
  documentName: fetchPayload['documentName'];
  context: fetchPayload['context'];
  collection: mongodb.Collection<CollectionDoc>;
  by: Awaited<ReturnType<DB['collectionAccessor']>>;
}

async function findOrCreateYdoc(params: FindOrCreateYDocParams): Promise<Uint8Array> {
  const { tenantDb, documentName, context, collection, by } = params;
  const { tenant, collectionName, itemId } = parseName(documentName);

  // get database document
  const dbDoc = await tenantDb.collection(tenant, collectionName)?.findOne(
    {
      [by.one[0]]:
        by.one[1] === 'ObjectId'
          ? new mongoose.Types.ObjectId(itemId)
          : by.one[1] === 'Date'
          ? new Date(itemId)
          : itemId,
    },
    { projection: { __yState: 1, __stateExists: 1 } }
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
  } else if (dbDoc?.__stateExists) {
    // state should exist, so maybe it has not saved yet and will be available in a few seconds
    throw new Error(`State for document '${documentName}' was not found in the database`);
  }

  // otherwise, we can create a new ydoc
  const ydoc = new Y.Doc();

  // immediately store in mongodb that document has been created
  // (to prevent __yState from being created again if client makes change and rapidly
  // refreshes before first save of __yState, which would cause client state field
  // values to be appended to injected values in `setDocValues`.)
  await collection.updateOne(
    {
      [by.one[0]]:
        by.one[1] === 'ObjectId'
          ? new mongoose.Types.ObjectId(itemId)
          : by.one[1] === 'Date'
          ? new Date(itemId)
          : itemId,
    },
    { $set: { __stateExists: true } }
  );

  // ensure `setDocValues` executes on this document
  context.shouldInjectDataToDoc = true;

  // hocuspocus requires the doc as a Uint8Array
  return Y.encodeStateAsUpdate(ydoc);
}

interface FindOldVersionYdoc {
  tenantDb: DB;
  documentName: fetchPayload['documentName'];
  context: fetchPayload['context'];
  collection: mongodb.Collection<CollectionDoc>;
  by: Awaited<ReturnType<DB['collectionAccessor']>>;
}

async function findOldVersionYdoc(params: FindOldVersionYdoc): Promise<Uint8Array> {
  const { tenantDb, documentName, by } = params;
  const { tenant, collectionName, itemId, version } = parseName(documentName);

  // get database document
  const dbDoc = await tenantDb.collection(tenant, collectionName)?.findOne(
    {
      [by.one[0]]:
        by.one[1] === 'ObjectId'
          ? new mongoose.Types.ObjectId(itemId)
          : by.one[1] === 'Date'
          ? new Date(itemId)
          : itemId,
    },
    { projection: { __yVersions: { $elemMatch: { timestamp: version || new Date() } } } }
  );

  // throw an error if the document was not found
  if (!dbDoc) {
    throw new Error(`Document '${documentName}' was not found in the database`);
  }

  // throw an error of the version state was not found
  if (!dbDoc?.__yVersions?.[0].state) {
    throw new Error(`Version state for '${documentName}' was not found in the database`);
  }

  // create a ydoc based on the version in the database
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, base64ToUint8(dbDoc.__yVersions[0].state)); // insert current encoded state into doc

  // hocuspocus requires the doc as a Uint8Array
  return Y.encodeStateAsUpdate(ydoc);
}
