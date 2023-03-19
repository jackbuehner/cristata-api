import { ListenerFunction } from ".";

const docUnpublishListener = (async ({ data, tenant }) => {
  if (data.operationType === 'update') {
    if (data.fullDocumentBeforeChange?.stage === 5.2 && data.updateDescription.updatedFields?.stage && data.updateDescription.updatedFields?.stage !== 5.2) {
      console.log(`event: unpublished ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via update`);
    }
  }

  if (data.operationType === 'replace') {
    if (data.fullDocumentBeforeChange?.stage === 5.2 && data.fullDocument.stage && data.fullDocument?.stage !== 5.2) {
      console.log(`event: unpublished ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via replace`);
    }
  }

  if (data.operationType === 'delete') {
    if (data.fullDocumentBeforeChange?.stage === 5.2) {
      console.log(`event: unpublished ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via delete`);
    }
  }
}) satisfies ListenerFunction;

export { docUnpublishListener };
