import { isObject } from 'is-what';
import type { BSON } from 'mongoose/node_modules/bson';
import type mongodb from 'mongoose/node_modules/mongodb';
import { hasKey } from './hasKey';

export function hasChangeStreamNamespace<TSchema extends BSON.Document = BSON.Document>(
  data: mongodb.ChangeStreamDocument
): data is ChangeStreamDocumentWithNamespace<TSchema> {
  return (
    isObject(data) &&
    hasKey('ns', data) &&
    isObject(data.ns) &&
    hasKey('db', data.ns) &&
    typeof data.ns.db === 'string' &&
    hasKey('coll', data.ns) &&
    typeof data.ns.coll === 'string'
  );
}

type ChangeStreamDocumentWithNamespace<TSchema extends BSON.Document = BSON.Document> =
  | mongodb.ChangeStreamInsertDocument<TSchema>
  | mongodb.ChangeStreamUpdateDocument<TSchema>
  | mongodb.ChangeStreamReplaceDocument<TSchema>
  | mongodb.ChangeStreamDeleteDocument<TSchema>
  | mongodb.ChangeStreamDropDocument
  | mongodb.ChangeStreamRenameDocument;
