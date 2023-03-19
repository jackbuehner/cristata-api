import { ListenerFunction } from ".";

const docPublishListener = (async ({ data, tenant }) => {
  if (data.operationType === 'update') {
    if (data.fullDocumentBeforeChange?.stage !== 5.2 && data.updateDescription.updatedFields?.stage === 5.2) {
      console.log(`event: published ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via update`);
    }
  }

  if (data.operationType === 'replace') {
    if (data.fullDocumentBeforeChange?.stage !== 5.2 && data.fullDocument?.stage === 5.2) {
      console.log(`event: published ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via replace`);
    }
  }

  if (data.operationType === 'insert') {
    if (data.fullDocument?.stage === 5.2) {
      console.log(`event: published ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via insert`);
    }
  }
}) satisfies ListenerFunction;

export { docPublishListener };
