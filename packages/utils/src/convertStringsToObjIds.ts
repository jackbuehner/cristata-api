import { isObject } from './isObject';
import mongoose from 'mongoose';
import { isObjectId } from './isObjectId';

/**
 * Returns an input object with string representations of BSON ObjectIDs replaced with actual BSON ObjectIDs.
 */
function convertStringsToObjIds(obj: Record<string | number, unknown>): Record<string | number, unknown> {
  // make a copy of the object
  const copy = { ...obj };

  // for each property in the copy
  Object.entries(copy).forEach(([key, value]) => {
    // if the value is a valid objectId
    if (isObjectId(value)) {
      copy[key] = new mongoose.Types.ObjectId(value);
    }

    // if the value is an object, send it through this function again
    else if (isObject(value)) {
      copy[key] = convertStringsToObjIds(value);
    }

    // if the value is an array, parse any objects inside it
    else if (Array.isArray(value)) {
      copy[key] = value.map((valueItem) => {
        // if the value is a valid objectId
        if (isObjectId(valueItem)) {
          return new mongoose.Types.ObjectId(valueItem);
        }

        // if the value is an object, send it through the function
        else if (isObject(valueItem)) {
          return convertStringsToObjIds(valueItem);
        }

        // otherwise, do nothing
        return valueItem;
      });
    }
  });

  // return the copy
  return copy;
}

export { convertStringsToObjIds };
