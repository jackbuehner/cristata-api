import mongoose from 'mongoose';

function insertUserToArray(
  arr: mongoose.Types.ObjectId[],
  user_id: mongoose.Types.ObjectId
): mongoose.Types.ObjectId[] {
  const setWithUniqueValuesOnly = new Set([
    ...(arr || []).filter((x) => !!x).map((_id) => _id.toHexString()),
    user_id.toHexString(),
  ]);
  return [...setWithUniqueValuesOnly].map((_id) => new mongoose.Types.ObjectId(_id));
}

export { insertUserToArray };
