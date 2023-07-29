import { storePayload } from '@hocuspocus/server';
import {
  DeconstructedSchemaDefType,
  conditionallyModifyDocField,
  deconstructSchema,
} from '@jackbuehner/cristata-generator-schema';
import { hasKey } from '@jackbuehner/cristata-utils';
import { addToY, getFromY } from '@jackbuehner/cristata-ydoc-utils';
import { detailedDiff } from 'deep-object-diff';
import { flatten } from 'flatten-anything';
import mongoose from 'mongoose';
import { calculateObjectSize } from 'mongoose/node_modules/bson';
import mongodb from 'mongoose/node_modules/mongodb';
import * as Y from 'yjs';
import { AwarenessUser, isAwarenessUser, parseName, reduceDays, uint8ToBase64 } from '../utils';
import { CollectionDoc, DB } from './DB';
import { TenantModel } from './TenantModel';
import { sendStageUpdateEmails } from './sendStageUpdateEmails';

export function store(tenantDb: DB) {
  return async ({ document: ydoc, documentName, context, requestParameters }: storePayload): Promise<void> => {
    try {
      const { tenant, collectionName, itemId, version } = parseName(documentName);

      // skip saving if an old version was opened because old versions cannot be edited
      if (version) return;

      // store that this connected client has modified something
      // (used to set history once the client disconnected)
      context.hasModified = true;
      context.lastModifiedAt = new Date().toISOString();
      context._id = requestParameters.get('_id') || '000000000000000000000000';

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
      const docData = await getFromY(ydoc, deconstructedSchema, {
        keepJsonParsed: true,
        hexIdsAsObjectIds: true,
        replaceUndefinedNull: true,
      });

      // modify doc data based on setters in the schema
      const changed = conditionallyModifyDocField(docData, deconstructedSchema);
      if (Object.keys(changed).length > 0) {
        await addToY({
          ydoc,
          schemaDef: deconstructedSchema,
          inputData: changed,
          TenantModel: TenantModel(tenantDb, tenant),
          onlyProvided: true, // only update the properties in `changed`
        });
      }

      // get database document
      const partialDbDoc = await collection.findOne(
        {
          [by.one[0]]:
            by.one[1] === 'ObjectId'
              ? new mongoose.Types.ObjectId(itemId)
              : by.one[1] === 'Date'
              ? new Date(itemId)
              : itemId,
        },
        { projection: { _id: 1, stage: 1 } }
      );
      const dbDocExists = !!partialDbDoc;

      // throw an error if the document was not found
      if (!dbDocExists) {
        console.error(
          '[MISSING DOC] FAILED TO SAVE YDOC WITH VALUES:',
          JSON.stringify(getFromY(ydoc, deconstructedSchema))
        );
        throw new Error(`Document '${documentName}' was not found in the database`);
      }

      // remove history array (we update this only on changes via the api)
      delete docData.history;

      // save document state
      const yState = uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
      collection.updateOne(
        {
          [by.one[0]]:
            by.one[1] === 'ObjectId'
              ? new mongoose.Types.ObjectId(itemId)
              : by.one[1] === 'Date'
              ? new Date(itemId)
              : itemId,
        },
        { $set: { ...docData, __yState: yState } }
      );

      // get the collection options
      const options = await tenantDb.collectionOptions(tenant, collectionName);

      // save versions asynchronously
      saveSnapshot(
        documentName,
        ydoc,
        collection,
        by,
        new Date(),
        deconstructedSchema,
        context,
        tenantDb,
        tenant
      );

      // send stage update emails
      if (hasKey('stage', partialDbDoc) && typeof partialDbDoc.stage === 'number') {
        sendStageUpdateEmails(
          documentName,
          docData,
          partialDbDoc.stage,
          collection,
          by,
          options,
          tenantDb,
          deconstructedSchema
        );
      }
    } catch (error) {
      console.error('[UNEXPECTED ERROR] FAILED TO SAVE YDOC WITH VALUES:', ydoc.toJSON());
      console.error(error);
    }
  };
}

/**
 * Create new snapshot and merge snapshots to database.
 */
async function saveSnapshot(
  documentName: storePayload['documentName'],
  ydoc: storePayload['document'],
  collection: mongodb.Collection<CollectionDoc>,
  by: Awaited<ReturnType<DB['collectionAccessor']>>,
  timestamp: Date,
  deconstructedSchema: DeconstructedSchemaDefType,
  context: Record<string, unknown>,
  tenantDb: DB,
  tenant: string
): Promise<mongodb.UpdateResult | void> {
  const { itemId } = parseName(documentName);

  // get awareness values and filter out unexpected values
  const awarenessValues = Array.from(ydoc.awareness.getStates().values()).filter(
    (value): value is AwarenessUser => {
      return isAwarenessUser(value);
    }
  );

  const users = awarenessValues.map((value) => value.user);

  // get database document
  const dbDoc = await collection.findOne(
    {
      [by.one[0]]:
        by.one[1] === 'ObjectId'
          ? new mongoose.Types.ObjectId(itemId)
          : by.one[1] === 'Date'
          ? new Date(itemId)
          : itemId,
    },
    { projection: { __yState: 0 } }
  );

  // get the yjs document data
  const data = await getFromY(ydoc, deconstructedSchema, {
    keepJsonParsed: true,
    hexIdsAsObjectIds: true,
    replaceUndefinedNull: true,
  });

  // determine which fields have changed
  const filterDoc = (doc: object): object =>
    Object.fromEntries(
      Object.entries(doc || {}).filter(([key]) => key.indexOf('_') !== 0 && key !== 'history')
    );
  const diff = detailedDiff(filterDoc(dbDoc || {}), filterDoc(data));
  const added = flatten(JSON.parse(JSON.stringify(diff.added))) as Record<string, unknown>;
  const deleted = flatten(JSON.parse(JSON.stringify(diff.deleted))) as Record<string, unknown>;
  const updated = flatten(JSON.parse(JSON.stringify(diff.updated))) as Record<string, unknown>;

  // delermine whether the document has actually meaningfully changed
  const changed = (() => {
    const anyAdded = Object.keys(added).length > 0;
    const anyDeleted = Object.keys(deleted).length > 0;
    const updatedKeys = Object.keys(updated).filter((key) => key !== 'timestamps.modified_at');
    const anyModified = updatedKeys.length > 0;
    return anyAdded || anyDeleted || anyModified;
  })();

  // return early if there wasn't a meaningful change so that there is no unnessary work done
  // after this line
  if (!changed) return;

  // store the changes that have occured
  context.diff = {
    added,
    deleted,
    updated: Object.fromEntries(Object.entries(updated).filter(([key]) => key !== 'timestamps.modified_at')),
  };

  // also updated the timestamp for changes
  await addToY({
    ydoc,
    schemaDef: deconstructedSchema,
    inputData: { timestamps: { modified_at: timestamp.toISOString() } },
    TenantModel: TenantModel(tenantDb, tenant),
    onlyProvided: true, // only update the properties in `inputData`
  });

  // get the size of the document
  const [docInfo] = await collection
    .aggregate<{ size_bytes: number; size_KB: number; size_MB: number }>([
      { $match: { _id: dbDoc?._id } },
      {
        $project: {
          size_bytes: { $bsonSize: '$$ROOT' },
          size_KB: { $divide: [{ $bsonSize: '$$ROOT' }, 1000] },
          size_MB: { $divide: [{ $bsonSize: '$$ROOT' }, 1000000] },
        },
      },
    ])
    .toArray();

  const tooLarge = docInfo.size_MB > 10;

  // create a snapshot of this point
  const state = uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
  let versions = [
    // reduce versions from previous days to single version
    ...reduceDays(dbDoc?.__yVersions, tooLarge ? 0 : 3), // must be at least 3 days old
    { state, timestamp, users },
  ];

  // check if the versions array is small enough, and make it smaller if it is not small enough
  const stillTooLarge = calculateObjectSize(versions) / 1000000 > 10;
  if (stillTooLarge) {
    versions = versions.slice(-1);
  }

  // create shared type with list of versions
  const versionsList = ydoc.getArray('__internal_versionsList');
  ydoc.transact(() => {
    versionsList.delete(0, versionsList.length);
    versionsList.insert(
      0,
      versions.map(({ timestamp, users }) => ({ timestamp: timestamp.toISOString(), users }))
    );
  });

  // save versions/snapshots
  const updateResult = collection.updateOne(
    {
      [by.one[0]]:
        by.one[1] === 'ObjectId'
          ? new mongoose.Types.ObjectId(itemId)
          : by.one[1] === 'Date'
          ? new Date(itemId)
          : itemId,
    },
    { $set: { __yVersions: versions } }
  );

  return updateResult;
}
