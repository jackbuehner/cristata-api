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
        [key]:
        // if the property is a mongoose objectID, convert it to its hexidecimal representation
          flatObj[key + '._bsontype'] === 'ObjectID'
            ? Buffer.from(flatObj[key + '.id']).toString('hex')
            : flatObj[key],
      })
    );
    return merge({}, ...keepProps) as mongoose.Document;
  });
  return pruned;
}

export { pruneDocs };
