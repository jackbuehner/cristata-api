import { onLoadDocumentPayload } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { addToY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import { DB } from './DB';
import { TenantModel } from './TenantModel';

/**
 * Sets the values in the ydoc based on database values.
 *
 * __This function must execute after the initial document has
 * loaded so it can read current values and replace them. Using
 * this function before the document has loaded will result
 * in duplicate values in each field.__
 */
export async function setDocValues(
  tenantDb: DB,
  documentName: onLoadDocumentPayload['documentName'],
  ydoc: onLoadDocumentPayload['document']
) {
  //
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
      { projection: { __yVersions: 0, yState: 0, __migrationBackup: 0, __yState: 0, __stateExists: 0 } }
    );

  // extract __ignoreBackup if it exists
  // @ts-expect-error ahhhh
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
}
