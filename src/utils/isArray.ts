/**
 * Whether the input is an array.
 */
function isArray(toCheck: unknown): toCheck is unknown[] {
  return toCheck !== null && toCheck !== undefined && typeof toCheck === 'object' && Array.isArray(toCheck);
}

export { isArray };
