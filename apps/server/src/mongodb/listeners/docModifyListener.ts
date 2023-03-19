import { ListenerFunction } from ".";

const docModifyListener = (async ({ data, tenant }) => {
  if (data.operationType === 'update') {
    console.log(`event: modified ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via update`);
  }

  if (data.operationType === 'replace') {
    console.log(`event: modified ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via replace`);
  }
}) satisfies ListenerFunction;

export { docModifyListener };
