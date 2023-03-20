export { docCreateListener } from './docCreateListener';
export { docDeleteListener } from './docDeleteListener';
export { docModifyListener } from './docModifyListener';
export { docPublishListener } from './docPublishListener';
export { docUnpublishListener } from './docUnpublishListener';
import {
  ChangeStreamEventDoc,
  EventDoc,
} from '@jackbuehner/cristata-generator-schema/src/default-schemas/Event';
import Cristata from 'Cristata';
import { DetailedDiff } from 'deep-object-diff';
import type mongodb from 'mongoose/node_modules/mongodb';
import { CollectionDoc } from '../../graphql/helpers';

export interface ListenerFunctionParams {
  data: mongodb.ChangeStreamDocument<CollectionDoc> & { wallTime: Date };
  tenant: string;
  cristata: Cristata;
  db: mongodb.Db;
  dispatchEvent: (doc: Omit<ChangeStreamEventDoc, '_id'>) => Promise<mongodb.InsertOneResult<EventDoc>>;
  computeDiff: (beforeDoc?: CollectionDoc, afterDoc?: CollectionDoc) => Partial<DetailedDiff>;
  getModelName: (collectionName: string) => string;
}

export type ListenerFunction = (params: ListenerFunctionParams) => Promise<void>;
