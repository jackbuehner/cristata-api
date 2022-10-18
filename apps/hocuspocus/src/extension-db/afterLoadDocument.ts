import { Extension } from '@hocuspocus/server';
import { DB } from './DB';
import { setDocValues } from './setDocValues';
import { updateReferenceValues } from './updateReferenceValues';

export function afterLoadDocument(tenantDb: DB) {
  const afterLoadDocument: Extension['afterLoadDocument'] = async ({
    document: ydoc,
    documentName,
    context,
  }): Promise<void> => {
    if (context.shouldInjectDataToDoc) {
      await setDocValues(tenantDb, documentName, ydoc);
      delete context.shouldInjectDataToDoc;
    } else {
      // we only update reference values when they could
      // be stale, but they definately are not stale
      // if the entire doc's field have been replaced
      updateReferenceValues(tenantDb, documentName, ydoc);
    }
  };

  return afterLoadDocument;
}
