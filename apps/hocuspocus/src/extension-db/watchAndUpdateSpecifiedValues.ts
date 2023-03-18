import { onLoadDocumentPayload } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { addToY, getFromY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import { parseName } from '../utils';
import { CollectionDoc, DB } from './DB';
import { TenantModel } from './TenantModel';
import { get as getProperty } from 'object-path';

/**
 * For the specified keys (`keysToWatchAndUpdate`), watch the document in
 * the database for changes and then apply those changes.
 *
 * For the purposes of Cristata, you only need to watch the keys in the
 * database that can change due to bulk changes to all documents in the
 * database.
 *
 * If a document is not already loaded because a client is currently
 * editing it, the change will not be reflected in __yState until
 * the next time the document is loaded.
 */
export async function watchAndUpdateSpecifiedValues(
  tenantDb: DB,
  documentName: onLoadDocumentPayload['documentName'],
  ydoc: onLoadDocumentPayload['document'],
  keysToWatchAndUpdate: string[]
): Promise<void> {
  const { tenant, collectionName, itemId, version } = parseName(documentName);

  // do not modify doc if it is an old version
  if (version) return;

  // get the collection
  const collection = tenantDb.collection(tenant, collectionName);
  if (!collection) {
    throw new Error(`Collection for document '${documentName}' was not found in the database`);
  }

  // get the collection accessor
  const by = await tenantDb.collectionAccessor(tenant, collectionName);

  // listen for changes to values
  (() => {
    // clear a mongodb change stream that watches this document for changes
    const changeStream = collection.watch(
      [
        {
          $match: {
            [`fullDocument.${by.one[0]}`]:
              by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId,
          },
        },
        {
          $project: {
            'fullDocument._id': 1,
            [`fullDocument.${by.one[0]}`]: 1,
            ...keysToWatchAndUpdate.reduce((obj, key) => {
              return Object.assign(obj, {
                [`fullDocument.${key}`]: 1,
              });
            }, {}),
          },
        },
      ],
      { fullDocument: 'updateLookup' }
    );

    changeStream.on('change', (data) => {
      if (data.operationType === 'update')
        applyRelevantChanges(tenantDb, documentName, ydoc, keysToWatchAndUpdate, data.fullDocument);
    });

    // destroy the change stream once the doc no longer exists
    // (e.g. after all clients disconnect)
    ydoc.on('destroy', () => {
      changeStream.close();
    });
  })();

  // get database document
  const dbDoc = await tenantDb
    .collection(tenant, collectionName)
    ?.findOne(
      { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
      { projection: { __yVersions: 0, yState: 0, __yState: 0, __migrationBackup: 0 } }
    );

  applyRelevantChanges(tenantDb, documentName, ydoc, keysToWatchAndUpdate, dbDoc);
}

async function applyRelevantChanges(
  tenantDb: DB,
  documentName: onLoadDocumentPayload['documentName'],
  ydoc: onLoadDocumentPayload['document'],
  keysToWatchAndUpdate: string[],
  dbDoc: CollectionDoc | null | undefined
) {
  const { tenant, collectionName } = parseName(documentName);

  // get the collection schema
  const schema = await tenantDb.collectionSchema(tenant, collectionName);
  const deconstructedSchema = deconstructSchema(schema);

  // get current ydoc values
  const docData = await getFromY(ydoc, deconstructedSchema, {
    keepJsonParsed: true,
    hexIdsAsObjectIds: true,
    replaceUndefinedNull: true,
  });

  // filter schema to only include defs for values that need to be updated
  const filteredDeconstructedSchema = deconstructedSchema.filter(([key]) => {
    return keysToWatchAndUpdate.includes(key) && isDifferent(key, dbDoc, docData);
  });

  // update values included in the filtered schema
  await addToY({
    ydoc,
    schemaDef: filteredDeconstructedSchema,
    inputData: dbDoc,
    TenantModel: TenantModel(tenantDb, tenant),
  });
}

/**
 * Whether the value of a property is different in the two provided objects.
 * Access keys with object-path dot notation.
 */
function isDifferent(
  key: string,
  doc1: CollectionDoc | null | undefined,
  doc2: Record<string, unknown> | undefined | null
): boolean {
  return getProperty(doc1 || {}, key) !== getProperty(doc2 || {}, key);
}
