import { isString } from 'is-what';

/**
 * Returns how many times a substring appears in a string.
 *
 * If either the string or substring is not a string, `0` will be returned.
 */
function countSubstringOccurance(str: string, substr: string): number {
  if (isString(str) && isString(substr)) {
    return str.split(substr).length - 1;
  }
  return 0;
}

export { countSubstringOccurance };
