export { docDeleteListener } from './docDeleteListener';
export { docModifyListener } from './docModifyListener';
export { docPublishListener } from './docPublishListener';
export { docUnpublishListener } from './docUnpublishListener';
import Cristata from 'Cristata';
import type mongodb from 'mongoose/node_modules/mongodb';
import { CollectionDoc } from '../../graphql/helpers';

export interface ListenerFunctionParams {
  data: mongodb.ChangeStreamDocument<CollectionDoc>;
  tenant: string;
  cristata: Cristata;
}

export type ListenerFunction = (params: ListenerFunctionParams) => Promise<void>;
