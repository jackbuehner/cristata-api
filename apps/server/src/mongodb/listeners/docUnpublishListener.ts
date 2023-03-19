import { ListenerFunction } from '.';

const docUnpublishListener = (async ({ data, dispatchEvent, computeDiff, getModelName }) => {
  if (data.operationType === 'update') {
    if (
      data.fullDocumentBeforeChange?.stage === 5.2 &&
      data.updateDescription.updatedFields?.stage &&
      data.updateDescription.updatedFields?.stage !== 5.2
    ) {
      const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
      dispatchEvent({
        name: 'unpublish',
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
    if (
      data.fullDocumentBeforeChange?.stage === 5.2 &&
      data.fullDocument.stage &&
      data.fullDocument?.stage !== 5.2
    ) {
      const diff = computeDiff(data.fullDocumentBeforeChange, data.fullDocument);
      dispatchEvent({
        name: 'unpublish',
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

  if (data.operationType === 'delete') {
    if (data.fullDocumentBeforeChange?.stage === 5.2) {
      dispatchEvent({
        name: 'unpublish',
        at: data.wallTime,
        reason: 'document delete',
        document: {
          _id: data.documentKey._id,
          collection: getModelName(data.ns.coll),
          doc: data.fullDocumentBeforeChange,
        },
      });
    }
  }
}) satisfies ListenerFunction;

export { docUnpublishListener };
