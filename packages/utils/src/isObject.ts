/**
 * Whether the input is an object that is neither an array nor null.
 */
function isObject(toCheck: unknown): toCheck is Record<string | number, unknown> {
  return typeof toCheck === 'object' && !Array.isArray(toCheck) && toCheck !== null;
}

export { isObject };
