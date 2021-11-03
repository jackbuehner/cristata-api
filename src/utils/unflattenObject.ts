/**
 * Unflattens an object.
 *
 * Adapted from https://www.30secondsofcode.org/js/s/unflatten-object
 *
 * @param obj the object to unflatten
 * @param sep the delimiter between flattened keys
 * @returns unflattened object
 */
function unflattenObject(obj: { [key: string]: unknown }, sep = '.'): { [key: string]: unknown } {
  return Object.keys(obj).reduce((res: { [key: string]: unknown }, key: string) => {
    key
      .split(sep)
      .reduce(
        (acc: { [key: string]: unknown }, e: string, i: number, keys: string[]) =>
          acc[e] || (acc[e] = isNaN(Number(keys[i + 1])) ? (keys.length - 1 === i ? obj[key] : {}) : []),
        res
      );
    return res;
  }, {});
}

export { unflattenObject };
