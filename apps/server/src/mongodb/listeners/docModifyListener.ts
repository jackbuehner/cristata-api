import { ListenerFunction } from '.';

const docModifyListener = (async ({ data, dispatchEvent, computeDiff, getModelName }) => {
  if (data.operationType === 'update') {
    const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
    dispatchEvent({
      name: 'modify',
      at: data.wallTime,
      reason: 'document update',
      document: {
        _id: data.documentKey._id,
        collection: getModelName(data.ns.coll),
        doc: data.fullDocument,
        added: diff.added,
        deleted: diff.deleted,
        updated: diff.updated,
      },
    });
  }

  if (data.operationType === 'replace') {
    const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
    dispatchEvent({
      name: 'modify',
      at: data.wallTime,
      reason: 'document replace',
      document: {
        _id: data.documentKey._id,
        collection: getModelName(data.ns.coll),
        doc: data.fullDocument,
        added: diff.added,
        deleted: diff.deleted,
        updated: diff.updated,
      },
    });
  }
}) satisfies ListenerFunction;

export { docModifyListener };
