import { ListenerFunction } from '.';

const docPublishListener = (async ({ data, dispatchEvent, computeDiff, getModelName }) => {
  if (data.operationType === 'update') {
    if (data.fullDocumentBeforeChange?.stage !== 5.2 && data.updateDescription.updatedFields?.stage === 5.2) {
      const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
      dispatchEvent({
        name: 'publish',
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
  }

  if (data.operationType === 'replace') {
    if (data.fullDocumentBeforeChange?.stage !== 5.2 && data.fullDocument?.stage === 5.2) {
      const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
      dispatchEvent({
        name: 'publish',
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
  }

  if (data.operationType === 'insert') {
    if (data.fullDocument?.stage === 5.2) {
      dispatchEvent({
        name: 'publish',
        at: data.wallTime,
        reason: 'document insert',
        document: {
          _id: data.documentKey._id,
          collection: getModelName(data.ns.coll),
          doc: data.fullDocument,
        },
      });
    }
  }
}) satisfies ListenerFunction;

export { docPublishListener };
