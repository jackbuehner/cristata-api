import { merge } from 'merge-anything';
import mongoose from 'mongoose';

interface PruneDocs<T> {
  input: T;
  keep: string[];
}

function pruneDocs<T extends mongoose.Document[]>({ input, keep }: PruneDocs<T>): mongoose.Document[] {
  const pruned = input.map((obj) => {
    const keepProps = keep.map((key) => ({ [key]: obj[key] }));
    return merge({}, ...keepProps) as mongoose.Document;
  });
  return pruned;
}

export { pruneDocs };
