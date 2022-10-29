import { onLoadDocumentPayload } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { addToY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import { parseName } from '../utils';
import { DB } from './DB';
import { TenantModel } from './TenantModel';

export async function updateReferenceValues(
  tenantDb: DB,
  documentName: onLoadDocumentPayload['documentName'],
  ydoc: onLoadDocumentPayload['document']
) {
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

  // get database document
  const dbDoc = await tenantDb
    .collection(tenant, collectionName)
    ?.findOne(
      { [by.one[0]]: by.one[1] === 'ObjectId' ? new mongoose.Types.ObjectId(itemId) : itemId },
      { projection: { __yVersions: 0, yState: 0, __migrationBackup: 0 } }
    );

  // update reference values
  await addToY({
    ydoc,
    schemaDef: deconstructSchema(await tenantDb.collectionSchema(tenant, collectionName)),
    inputData: dbDoc,
    TenantModel: TenantModel(tenantDb, tenant),
    updateReferencesMode: true, // only update references, and only if they are stale
  });
}
