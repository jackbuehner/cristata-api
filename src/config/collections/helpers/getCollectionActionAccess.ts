import { canDo } from '.';
import { Context } from '../../../apollo';

interface GetCollectionActionAccess {
  model: string;
  context: Context;
}

interface GetCollectionActionAccessReturn {
  get: boolean;
  create: boolean;
  modify: boolean;
  hide: boolean;
  lock: boolean;
  watch: boolean;
  publish: boolean;
  deactivate: boolean | null;
  delete: boolean;
}

function getCollectionActionAccess({
  model,
  context,
}: GetCollectionActionAccess): GetCollectionActionAccessReturn {
  return {
    get: canDo({ model, action: 'get', context }),
    create: canDo({ model, action: 'create', context }),
    modify: canDo({ model, action: 'modify', context }),
    hide: canDo({ model, action: 'hide', context }),
    lock: canDo({ model, action: 'lock', context }),
    watch: canDo({ model, action: 'watch', context }),
    publish: canDo({ model, action: 'publish', context }),
    deactivate: model === 'User' ? canDo({ model, action: 'deactivate', context }) : null,
    delete: canDo({ model, action: 'delete', context }),
  };
}

export { getCollectionActionAccess };
