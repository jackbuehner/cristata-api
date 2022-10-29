import mongoose from 'mongoose';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/helpers/constructBasicSchemaFields';

import { archiveDoc } from './archiveDoc';
import { createDoc } from './createDoc';
import { modifyDoc } from './modifyDoc';
import { hideDoc } from './hideDoc';
import { lockDoc } from './lockDoc';
import { watchDoc } from './watchDoc';
import { findDoc } from './findDoc';
import { canDo } from './canDo';
import { deleteDoc } from './deleteDoc';
import { findDocs } from './findDocs';
import { cloneDoc } from './cloneDoc';
import { genSchema } from '@jackbuehner/cristata-generator-schema';
import { requireAuthentication } from './requireAuthentication';
import { getCollectionActionAccess } from './getCollectionActionAccess';
import { publishDoc } from './publishDoc';
import { getUsers } from './getUsers';
import { gql } from './gql';
import { genCollection } from './generators/genCollection';
import { genResolvers } from './generators/genResolvers';

const helpers = {
  archiveDoc,
  createDoc,
  modifyDoc,
  hideDoc,
  lockDoc,
  watchDoc,
  findDoc,
  canDo,
  deleteDoc,
  findDocs,
  cloneDoc,
  requireAuthentication,
  getCollectionActionAccess,
  publishDoc,
  getUsers,
  gql,
  generators: { genCollection, genResolvers, genSchema },
};

type Helpers = typeof helpers;

type CollectionDoc = CollectionSchemaFields &
  Partial<PublishableCollectionSchemaFields> &
  Partial<WithPermissionsCollectionSchemaFields> &
  Partial<Record<string, unknown>> &
  Partial<{ people: Partial<{ editors: Record<string, unknown>; [key: string]: unknown }> }> &
  Partial<{ timestamps: Record<string, unknown> }> & { _id: mongoose.Types.ObjectId };

export type { CollectionDoc, Helpers };
export { archiveDoc };
export { createDoc };
export { modifyDoc };
export { hideDoc };
export { lockDoc };
export { watchDoc };
export { findDoc };
export { canDo };
export { deleteDoc };
export { findDocs };
export { cloneDoc };
export { requireAuthentication };
export { getCollectionActionAccess };
export { publishDoc };
export { getUsers };
export { gql };
export { genCollection };
export { genResolvers };
export { genSchema };
export default helpers;
