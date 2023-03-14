import { Extension } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import type { ActivityDoc } from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Activity';
import { getFromY } from '@jackbuehner/cristata-ydoc-utils';
import { detailedDiff } from 'deep-object-diff';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import { AwarenessUser, isAwarenessUser } from '../utils/isAwarenessUser';
import { DB } from './DB';

export function onDisconnect(tenantDb: DB) {
  const onDisconnect: Extension['onDisconnect'] = async ({
    documentName,
    context,
    document: ydoc,
  }): Promise<void> => {
    const [tenant, collectionName, itemId] = documentName.split('.');

    // get awareness values and filter out unexpected values
    const awarenessValues = Array.from(ydoc.awareness.getStates().values()).filter(
      (value): value is AwarenessUser => {
        return isAwarenessUser(value);
      }
    );

    // TODO: get rid of this in a future version
    if (
      context.hasModified &&
      context.lastModifiedAt &&
      context._id &&
      context._id.length === 24 &&
      itemId.length === 24
    ) {
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

    if (
      context.hasModified &&
      context.lastModifiedAt &&
      context._id &&
      context._id.length === 24 &&
      itemId.length === 24
    ) {
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
      ) as mongodb.Collection<ActivityDoc> | null;
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

      // create a list of user ids that are currently in the doc or just disconnected
      const userIds = Array.from(
        new Set(...[context._id as string, ...awarenessValues.map((value) => value.user._id)])
      )
        .filter((hexId) => hexId.length === 24)
        .map((hexId) => new mongoose.Types.ObjectId(hexId));

      // save the activity/history
      if (itemId.length === 24) {
        activitiesCollection.insertOne({
          name: data.name,
          type: 'ydoc-modified',
          colName: collectionName,
          docId: new mongoose.Types.ObjectId(itemId),
          userIds,
          at: new Date(context.lastModifiedAt),
          added,
          deleted,
          updated,
        });
      }
    }
  };

  return onDisconnect;
}
