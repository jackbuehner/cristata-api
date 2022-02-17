import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';

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
export { withPubSub } from './withPubSub';

type CollectionDoc = CollectionSchemaFields &
  Partial<PublishableCollectionSchemaFields> &
  Partial<WithPermissionsCollectionSchemaFields> &
  Partial<Record<string, unknown>> &
  Partial<{ people: Partial<{ editors: Record<string, unknown>; [key: string]: unknown }> }> &
  Partial<{ timestamps: Record<string, unknown> }>;

export type { CollectionDoc };
