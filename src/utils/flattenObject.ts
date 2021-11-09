const PROHIBITED_KEYS = ['$__', '$op', '$init', '$__parent', '$isSingleNested'];

/**
 * Flattens an object while retaining its roots.
 *
 * @param obj the objectto flatten
 * @param roots any roots that need to be prepended to the key in the flattened object
 * @param sep the spearator to go between each root
 * @returns flattened object
 */
function flattenObject(
  obj: { [key: string]: never },
  roots: string[] = [],
  sep = '.',
  tier = 0,
  maxTier = 10
): { [key: string]: never } {
  // refuse to flatten if tier is greater than the maximum allowed tier
  // (this is to prevent crashes if an object references itself in one of its properties)
  if (tier > maxTier) return {};

  // store the flattened object
  const flattened: { [key: string]: never } = {};

  // iterate through each key
  Object.keys(obj).forEach((key) => {
    // if the key is prohibited, do nothing
    if (PROHIBITED_KEYS.includes(key)) {
      null;
    }
    // if the key is an object, flatten the object with this function
    else if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
      Object.assign(flattened, flattenObject(obj[key], [...roots, key], sep, tier + 1));
    }
    // otherwise, add to flattened object
    else {
      const flatKey = [...roots, key].join(sep).replace(/_doc./g, ''); // remove _doc in case the object was a mongoose subdocument
      flattened[flatKey] = obj[key];
    }
  });

  return flattened;
}

export { flattenObject };
