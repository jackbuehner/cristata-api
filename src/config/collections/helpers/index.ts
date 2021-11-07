import { CollectionSchemaFields, PublishableCollectionSchemaFields } from '../../../mongodb/db';

export { createDoc } from './createDoc';
export { modifyDoc } from './modifyDoc';
export { hideDoc } from './hideDoc';
export { lockDoc } from './lockDoc';
export { watchDoc } from './watchDoc';
export { findDoc } from './findDoc';
export { canDo } from './canDo';
export { deleteDoc } from './deleteDoc';
export { findDocs } from './findDocs';
export { requireAuthentication } from './requireAuthentication';
export { pruneDocs } from './pruneDocs';
export { findDocAndPrune } from './findDocAndPrune';
export { findDocsAndPrune } from './findDocsAndPrune';
export { getCollectionActionAccess } from './getCollectionActionAccess';
export { publishDoc } from './publishDoc';

type CollectionDoc = CollectionSchemaFields &
  Partial<PublishableCollectionSchemaFields> &
  Record<string, unknown> & { people: Record<string, unknown> } & {
    people: { editors: Record<string, unknown> };
  } & { timestamps: Record<string, unknown> };

export type { CollectionDoc };
