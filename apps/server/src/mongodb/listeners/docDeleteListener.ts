import { ListenerFunction } from ".";

const docDeleteListener = (async ({ data, tenant }) => {
  if (data.operationType === 'delete') {
    console.log(`event: deleted ${data.ns.db || tenant}.${data.ns.coll}.${data.documentKey._id} via delete`);
  }
}) satisfies ListenerFunction;

export { docDeleteListener };
