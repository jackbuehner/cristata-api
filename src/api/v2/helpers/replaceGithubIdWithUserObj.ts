import { flattenObject } from '../../../utils/flattenObject';
import mongoose from 'mongoose';

/**
 * Replaces GitHub IDs stored in the values of the given keys with full user
 * profiles from the users collection.
 *
 * @param flatKeys array of flat keys from the schema that, used to replace GitHub IDs with user profile object
 * @param collection name of the collection
 * @returns array of aggregation stages
 */
function replaceGithubIdWithUserObj(flatKeys: string[], collection: string): mongoose.PipelineStage[] {
  const flatSchema = flattenObject(mongoose.model(collection).schema.obj);

  const replacementStages = flatKeys.map((key) => {
    return {
      // aggregation stage to replace user ids stored in
      // the properties of the provided flatKeys
      // with full profiles from the users collection
      $lookup: {
        from: 'users',
        localField: key,
        foreignField: 'github_id',
        as: key,
      },
    };
  });

  const removeArrayStages = flatKeys.map((key) => {
    // determine whether the the field needs to be a single
    // value or an array of values by checking if the schema
    // says it is a single GitHub ID
    const isSingle = flatSchema[key + '.type'] === Number;

    if (isSingle) {
      // aggregation stage to replace an existing field
      // that contains an array of profiles with the first
      // profiles object inside the array (from index 0)
      return {
        $addFields: {
          [key]: {
            $arrayElemAt: [`$${key}`, 0], // extra $ tells mongoose to get the value of the key
          },
        },
      };
    }

    // aggregation stage that does nothing
    return {
      $addFields: {},
    };
  });

  // return the aggrgation stages
  return [...replacementStages, ...removeArrayStages];
}

export { replaceGithubIdWithUserObj };
