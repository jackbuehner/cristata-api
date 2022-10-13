import { Extension } from '@hocuspocus/server';
import mongoose from 'mongoose';
import { DB } from './DB';

export function onDisconnect(tenantDb: DB) {
  const onDisconnect: Extension['onDisconnect'] = async ({ documentName, context }): Promise<void> => {
    const [tenant, collectionName, itemId] = documentName.split('.');

    if (context.hasModified && context.lastModifiedAt && context._id) {
      const historyItem = {
        type: 'ydoc-modified',
        user: new mongoose.Types.ObjectId(context._id),
        at: new Date(context.lastModifiedAt),
      };

      // get the collection
      const collection = tenantDb.collection(tenant, collectionName);
      if (!collection) {
        console.error('[INVALID COLLECTION] FAILED TO SAVE DOC HISTORY FOR DOC:', documentName);
        throw new Error(`Document '${documentName}' was not found in the database`);
      }

      // get the collection accessor
      const by = await tenantDb.collectionAccessor(tenant, collectionName);

      // push history item
      await collection.updateOne(
        { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
        { $push: { history: historyItem } }
      );
    }
  };

  return onDisconnect;
}
