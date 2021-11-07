import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { flattenObject } from '../../../utils/flattenObject';
import { unflattenObject } from '../../../utils/unflattenObject';

interface PruneDocs<T> {
  input: T;
  keep: string[];
}

function pruneDocs<T extends mongoose.Document[]>({ input, keep }: PruneDocs<T>): mongoose.Document[] {
  const pruned = input.map((obj) => {
    const flatObj = flattenObject(obj as unknown as { [key: string]: never });
    const keepProps = keep.map((key) =>
      unflattenObject({
        [key]: key === '_id' ? new mongoose.Types.ObjectId(flatObj['_id.id']) : flatObj[key],
      })
    );
    return merge({}, ...keepProps) as mongoose.Document;
  });
  return pruned;
}

export { pruneDocs };
