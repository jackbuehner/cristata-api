import { fetchPayload } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { addToY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import * as Y from 'yjs';
import { base64ToUint8 } from '../utils';
import { DB } from './DB';
import { TenantModel } from './TenantModel';

export function fetch(tenantDb: DB) {
  return async ({ documentName }: fetchPayload): Promise<Uint8Array | null> => {
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
        { projection: { __yVersions: 0, yState: 0, __migrationBackup: 0 } }
      );

    // throw an error if the document was not found
    if (!dbDoc) {
      throw new Error(`Document '${documentName}' was not found in the database`);
    }

    // if the database document was found and it contains an encoded ydoc state,
    // create a ydoc based on the version in the database
    if (dbDoc?.__yState) {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, base64ToUint8(dbDoc.__yState)); // insert current encoded state into doc
      return Y.encodeStateAsUpdate(ydoc);
    }

    // otherwise, we can create a new ydoc
    const ydoc = new Y.Doc();

    // extract __ignoreBackup if it exists
    const { __ignoreBackup, ...inputData } = dbDoc;

    // backup current data if __ignoreBackup is not true
    // (we may want this is we are resetting the __yState value
    // but still want to keep the existing backup)
    if (!__ignoreBackup) {
      const __migrationBackup = dbDoc as unknown as never;
      collection.updateOne(
        { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
        { $set: { __migrationBackup } }
      );
    }

    // add data to ydoc, which will be the collaborative source of truth for clients
    await addToY({
      ydoc,
      schemaDef: deconstructSchema(await tenantDb.collectionSchema(tenant, collectionName)),
      inputData: inputData,
      TenantModel: TenantModel(tenantDb, tenant),
    });

    // hocuspocus requires the doc as a Uint8Array
    return Y.encodeStateAsUpdate(ydoc);
  };
}
