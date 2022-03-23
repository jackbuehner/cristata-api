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
    get: await canDo({ model, action: 'get', context, doc }),
    create: await canDo({ model, action: 'create', context, doc }),
    modify: await canDo({ model, action: 'modify', context, doc }),
    hide: await canDo({ model, action: 'hide', context, doc }),
    lock: await canDo({ model, action: 'lock', context, doc }),
    watch: await canDo({ model, action: 'watch', context, doc }),
    publish: await canDo({ model, action: 'publish', context, doc }),
    deactivate: model === 'User' ? await canDo({ model, action: 'deactivate', context, doc }) : null,
    delete: await canDo({ model, action: 'delete', context, doc }),
  };
}

export { getCollectionActionAccess };
