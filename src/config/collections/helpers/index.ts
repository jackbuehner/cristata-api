import { CollectionSchemaFields, PublishableCollectionSchemaFields } from '../../../mongodb/db';

export { createDoc } from './createDoc';
export { modifyDoc } from './modifyDoc';
export { hideDoc } from './hideDoc';
export { lockDoc } from './lockDoc';
export { watchDoc } from './watchDoc';
export { findDoc } from './findDoc';
export { canDo } from './canDo';
export { deleteDoc } from './deleteDoc';

type CollectionDoc = CollectionSchemaFields &
  Partial<PublishableCollectionSchemaFields> &
  Record<string, unknown> & { people: Record<string, unknown> } & {
    people: { editors: Record<string, unknown> };
  } & { timestamps: Record<string, unknown> };

export type { CollectionDoc };
