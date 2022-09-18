import { storePayload } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { getFromY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import * as Y from 'yjs';
import { AwarenessUser, isAwarenessUser, uint8ToBase64 } from '../utils';
import { DB } from './DB';

export function store(tenantDb: DB) {
  return async ({ document: ydoc, documentName }: storePayload): Promise<void> => {
    const [tenant, collectionName, itemId] = documentName.split('.');

    // get awareness values and filter out unexpected values
    const awarenessValues = Array.from(ydoc.awareness.getStates().values()).filter(
      (value): value is AwarenessUser => {
        return isAwarenessUser(value);
      }
    );

    // get the collection
    const collection = tenantDb.collection(tenant, collectionName);
    if (!collection) {
      console.error('[INVALID COLLECTION] FAILED TO SAVE YDOC WITH VALUES:', ydoc.toJSON());
      throw new Error(`Document '${documentName}' was not found in the database`);
    }

    // get the collection accessor
    const by = await tenantDb.collectionAccessor(tenant, collectionName);

    // get the collection schema
    const schema = await tenantDb.collectionSchema(tenant, collectionName);
    const deconstructedSchema = deconstructSchema(schema || {});

    // get the values of the ydoc shared types
    // (to be used for setting database document values)
    //const docData = await getFromY(ydoc, deconstructedSchema, { keepJsonParsed: true });

    // get database document
    const dbDoc = await collection.findOne({
      [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId,
    });

    // throw an error if the document was not found
    if (!dbDoc) {
      console.error(
        '[MISSING DOC] FAILED TO SAVE YDOC WITH VALUES:',
        JSON.stringify(getFromY(ydoc, deconstructedSchema))
      );
      throw new Error(`Document '${documentName}' was not found in the database`);
    }

    // create a snapshot of this point
    const snapshot = Y.snapshot(ydoc);
    const version = {
      snapshot: uint8ToBase64(Y.encodeSnapshot(snapshot)),
      users: awarenessValues.map((value) => value.user),
    };

    // save document state
    const yState = uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
    collection.updateOne(
      { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
      { $set: { __yState: yState }, $push: { __yVersions: version } }
    );
  };
}
