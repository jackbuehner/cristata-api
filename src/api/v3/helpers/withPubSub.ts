/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { pubsub } from '../../../apollo';

async function withPubSub(name: string, type: string, mutation: Promise<unknown>) {
  const payload = await mutation;
  pubsub.publish(`${name.toUpperCase()}_${type.toUpperCase()}`, {
    [`${name.toLowerCase()}${type.slice(0, 1).toUpperCase() + type.slice(1).toLowerCase()}`]: payload,
  });
  return payload;
}

export { withPubSub };
