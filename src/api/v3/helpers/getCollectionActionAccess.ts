import mongoose from 'mongoose';
import { canDo, findDoc } from '.';
import { Context } from '../../../apollo';

interface GetCollectionActionAccess {
  model: string;
  context: Context;
  args?: {
    _id?: mongoose.Types.ObjectId | string | number | Date;
    by?: string;
  };
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

async function getCollectionActionAccess({
  model,
  context,
  args,
}: GetCollectionActionAccess): Promise<GetCollectionActionAccessReturn> {
  // get the document if a document id has been provided
  const doc = args?._id
    ? ((await findDoc({ model, _id: args._id, by: args.by, context })) as never)
    : undefined;

  // return all permissions
  return {
    get: canDo({ model, action: 'get', context, doc }),
    create: canDo({ model, action: 'create', context, doc }),
    modify: canDo({ model, action: 'modify', context, doc }),
    hide: canDo({ model, action: 'hide', context, doc }),
    lock: canDo({ model, action: 'lock', context, doc }),
    watch: canDo({ model, action: 'watch', context, doc }),
    publish: canDo({ model, action: 'publish', context, doc }),
    deactivate: model === 'User' ? canDo({ model, action: 'deactivate', context, doc }) : null,
    delete: canDo({ model, action: 'delete', context, doc }),
  };
}

export { getCollectionActionAccess };
