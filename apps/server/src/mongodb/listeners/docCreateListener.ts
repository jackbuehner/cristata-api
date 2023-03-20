import { ListenerFunction } from '.';

const docCreateListener = (async ({ data, dispatchEvent, getModelName }) => {
  if (data.operationType === 'insert') {
    dispatchEvent({
      name: 'create',
      at: data.wallTime,
      reason: 'document insert',
      document: {
        _id: data.documentKey._id,
        collection: getModelName(data.ns.coll),
        doc: data.fullDocument,
      },
    });
  }
}) satisfies ListenerFunction;

export { docCreateListener };
