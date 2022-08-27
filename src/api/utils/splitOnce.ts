/**
 * Splits a string by a separator once.
 */
function splitOnce(str: string, sep: string): [string, string | null] {
  const [first, ...rest] = str.split(sep);
  return [first, rest.length > 0 ? rest.join(sep) : null];
}

export { splitOnce };
