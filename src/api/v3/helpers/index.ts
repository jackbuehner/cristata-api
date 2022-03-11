import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';

import { createDoc } from './createDoc';
import { modifyDoc } from './modifyDoc';
import { hideDoc } from './hideDoc';
import { lockDoc } from './lockDoc';
import { watchDoc } from './watchDoc';
import { findDoc } from './findDoc';
import { canDo } from './canDo';
import { deleteDoc } from './deleteDoc';
import { findDocs } from './findDocs';
import { genSchema } from './genSchema';
import { requireAuthentication } from './requireAuthentication';
import { pruneDocs } from './pruneDocs';
import { findDocAndPrune } from './findDocAndPrune';
import { findDocsAndPrune } from './findDocsAndPrune';
import { getCollectionActionAccess } from './getCollectionActionAccess';
import { publishDoc } from './publishDoc';
import { withPubSub } from './withPubSub';
import { getUsers } from './getUsers';
import { gql } from './gql';
import { genCollection } from './generators/genCollection';
import { genResolvers } from './generators/genResolvers';

const helpers = {
  createDoc,
  modifyDoc,
  hideDoc,
  lockDoc,
  watchDoc,
  findDoc,
  canDo,
  deleteDoc,
  findDocs,
  genSchema,
  requireAuthentication,
  pruneDocs,
  findDocAndPrune,
  findDocsAndPrune,
  getCollectionActionAccess,
  publishDoc,
  withPubSub,
  getUsers,
  gql,
  generators: { genCollection, genResolvers },
};

type Helpers = typeof helpers;

type CollectionDoc = CollectionSchemaFields &
  Partial<PublishableCollectionSchemaFields> &
  Partial<WithPermissionsCollectionSchemaFields> &
  Partial<Record<string, unknown>> &
  Partial<{ people: Partial<{ editors: Record<string, unknown>; [key: string]: unknown }> }> &
  Partial<{ timestamps: Record<string, unknown> }>;

export type { CollectionDoc, Helpers };
export { createDoc };
export { modifyDoc };
export { hideDoc };
export { lockDoc };
export { watchDoc };
export { findDoc };
export { genSchema };
export { canDo };
export { deleteDoc };
export { findDocs };
export { requireAuthentication };
export { pruneDocs };
export { findDocAndPrune };
export { findDocsAndPrune };
export { getCollectionActionAccess };
export { publishDoc };
export { withPubSub };
export { getUsers };
export { gql };
export { genResolvers };
export default helpers;
