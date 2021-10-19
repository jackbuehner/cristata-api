/**
 * Flattens an object while retaining its roots.
 *
 * @param obj the objectto flatten
 * @param roots any roots that need to be prepended to the key in the flattened object
 * @param sep the spearator to go between each root
 * @returns flattened object
 */
function flattenObject(obj: { [key: string]: any }, roots: string[] = [], sep = '.') {
  // store the flattened object
  let flattened: { [key: string]: any } = {};

  // iterate through each key
  Object.keys(obj).forEach((key) => {
    // if the key is an object, flatten the object with this function
    if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
      Object.assign(flattened, flattenObject(obj[key], [...roots, key], sep));
    }
    // otherwise, add to flattened object
    else {
      const flatKey = [...roots, key].join(sep);
      flattened[flatKey] = obj[key];
    }
  });

  return flattened;
}

export { flattenObject };
