import { ListenerFunction } from '.';

const docDeleteListener = (async ({ data, dispatchEvent, getModelName }) => {
  if (data.operationType === 'delete') {
    dispatchEvent({
      name: 'delete',
      at: data.wallTime,
      reason: 'document delete',
      document: {
        _id: data.documentKey._id,
        collection: getModelName(data.ns.coll),
        doc: data.fullDocumentBeforeChange,
      },
    });
  }
}) satisfies ListenerFunction;

export { docDeleteListener };
