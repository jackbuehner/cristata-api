import { isIsoDateString } from './isIsoDateString';
import { isObject } from './isObject';

/**
 * Returns an input object with ISO date strings replaced with javascript dates.
 */
function converObjIsoDatesToDates(obj: Record<string | number, unknown>): Record<string | number, unknown> {
  // make a copy of the object
  const copy = { ...obj };

  // for each property in the copy
  Object.entries(copy).forEach(([key, value]) => {
    // if the value is an ISO date string, covert the value to a Date in the copy
    if (isIsoDateString(value)) {
      copy[key] = new Date(value);
    }

    // if the value is an object, send it through this function again
    else if (isObject(value)) {
      copy[key] = converObjIsoDatesToDates(value);
    }
  });

  // return the copy
  return copy;
}

export { converObjIsoDatesToDates };
