import mongoose from 'mongoose';

function transformHexToObjectId({ value, label }: Record<string, unknown>): {
  value: string | mongoose.Types.ObjectId;
  label: string;
} {
  if (value && label && typeof value === 'string' && typeof label === 'string') {
    return { value: new mongoose.Types.ObjectId(value), label };
  }
  return { value: `${value}`, label: `${label || value}` };
}

export { transformHexToObjectId };
