import { Extension } from '@hocuspocus/server';
import { DB } from './DB';
import { updateReferenceValues } from './updateReferenceValues';

export function afterLoadDocument(tenantDb: DB) {
  const afterLoadDocument: Extension['afterLoadDocument'] = async ({
    document: ydoc,
    documentName,
  }): Promise<void> => {
    updateReferenceValues(tenantDb, documentName, ydoc);
  };

  return afterLoadDocument;
}
