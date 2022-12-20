import { isObject } from 'is-what';

/**
 * Similar to `get` from `object-path`, but it can access all property values
 * in an array without specifying that a key is an array.
 *
 * For example, `a.b.c` can return `['x', 'y']` from `{ a: { b: [{ c: 'x' }, { c: 'y' }] } }`.
 *
 * The return value is an array where the first element is the found value and the
 * section value is an updated key/path with `$` inserted where an array was found.
 * The first element will only be an array if an array is found.
 */
function getPropertyInArray(obj: Record<string, unknown>, searchKey: string): [unknown[] | unknown, string] {
  const [firstSearch, ...restSearch] = searchKey.split('.');
  const found = obj[firstSearch];

  if (Array.isArray(found)) {
    const vals = found.map((foundPiece) => {
      return getPropertyInArray(foundPiece, restSearch.join('.'));
    });
    const determinedRestSearch = vals[0][1];
    const determinedSearchKey = firstSearch + '.$.' + determinedRestSearch;
    return [vals.map((v) => v[0]), determinedSearchKey];
  } else if (isObject(found)) {
    const val = getPropertyInArray(found, restSearch.join('.'));
    const determinedRestSearch = val[1];
    const determinedSearchKey = firstSearch + '.' + determinedRestSearch;
    return [val[0], determinedSearchKey];
  }
  return [found, firstSearch];
}

export { getPropertyInArray };
