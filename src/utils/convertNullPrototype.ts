import { merge } from 'merge-anything';
import { isObject } from './isObject';

/**
 * Convert objects with the null prototype to the normal object prototype.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function convertNullPrototype<T extends Record<string, unknown>>(obj: T): T {
  return merge(
    // @ts-expect-error the map will always return on objects, and merge accepts unlimited objects
    ...Object.keys(obj).map((key) => {
      const value = obj[key];

      // if it is an object of null prototype, make it an object with the normal prototype
      if (isObject(value) && Object.getPrototypeOf(value) === null) {
        return { [key]: { ...convertNullPrototype(value) } };
      }

      // otherwise, return the value
      return { [key]: value };
    })
  ) as T;
}

export { convertNullPrototype };
