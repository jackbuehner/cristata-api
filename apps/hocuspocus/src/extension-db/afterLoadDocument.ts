import { Extension } from '@hocuspocus/server';
import { deconstructSchema } from '@jackbuehner/cristata-generator-schema';
import { addToY } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import { DB } from './DB';
import { TenantModel } from './TenantModel';

export function afterLoadDocument(tenantDb: DB) {
  const afterLoadDocument: Extension['afterLoadDocument'] = async ({
    document: ydoc,
    documentName,
  }): Promise<void> => {
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

    // update reference values
    await addToY({
      ydoc,
      schemaDef: deconstructSchema(await tenantDb.collectionSchema(tenant, collectionName)),
      inputData: dbDoc,
      TenantModel: TenantModel(tenantDb, tenant),
      updateReferencesMode: true, // only update references, and only if they are stale
    });
  };

  return afterLoadDocument;
}
