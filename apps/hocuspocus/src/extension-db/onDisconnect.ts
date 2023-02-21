import { Extension } from '@hocuspocus/server';
import type { IActivity } from '@jackbuehner/cristata-api/dist/mongodb/activities';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { getFromY } from '@jackbuehner/cristata-ydoc-utils';
import { detailedDiff } from 'deep-object-diff';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import { DB } from './DB';

export function onDisconnect(tenantDb: DB) {
  const onDisconnect: Extension['onDisconnect'] = async ({
    documentName,
    context,
    document: ydoc,
  }): Promise<void> => {
    const [tenant, collectionName, itemId] = documentName.split('.');

    // TODO: get rid of this in a future version
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

    if (context.hasModified && context.lastModifiedAt && context._id) {
      // get the collection schema
      const schema = await tenantDb.collectionSchema(tenant, collectionName);
      const deconstructedSchema = deconstructSchema(schema || {});

      // get the collection accessor
      const by = await tenantDb.collectionAccessor(tenant, collectionName);

      // get database document
      const dbDoc = await tenantDb
        .collection(tenant, collectionName)
        ?.findOne(
          { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
          { projection: { __yState: 0, __stateExists: 0, __yVersions: 0 } }
        );

      // get the document data
      const data = await getFromY(ydoc, deconstructedSchema, {
        keepJsonParsed: true,
        hexIdsAsObjectIds: true,
        replaceUndefinedNull: true,
      });

      // get the activities collection, which is where activity/history is stored
      const activitiesCollection = tenantDb.collection(
        tenant,
        'Activity'
      ) as mongodb.Collection<IActivity> | null;
      if (!activitiesCollection) {
        console.error('[INVALID COLLECTION] FAILED TO SAVE DOC ACTIVITY FOR DOC:', documentName);
        throw new Error(`Activity collection was not found in the database`);
      }

      // determine which fields have changed
      // TODO: find a way to create diff from the doc version that existed before -> maybe this logic needs to move to ./store.ts
      const filterDoc = (doc: object): object =>
        Object.fromEntries(
          Object.entries(doc || {}).filter(([key]) => key.indexOf('_') !== 0 && key !== 'history')
        );
      const { added, deleted, updated } = detailedDiff(filterDoc(dbDoc || {}), filterDoc(data));

      // save the activity/history
      activitiesCollection.insertOne({
        name: data.name,
        type: 'ydoc-modified',
        colName: collectionName,
        docId: new mongoose.Types.ObjectId(itemId),
        userIds: [new mongoose.Types.ObjectId(context._id)],
        at: new Date(context.lastModifiedAt),
        added,
        deleted,
        updated,
      });
    }
  };

  return onDisconnect;
}
