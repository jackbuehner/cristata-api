/**
 * Converts a camelCase string to dash-case.
 *
 * _Adapted from https://www.cloudhadoop.com/javascript-camel-hyphen/
 */
function camelToDashCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export { camelToDashCase };
