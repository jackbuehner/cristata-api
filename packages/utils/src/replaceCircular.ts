/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-var */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { isObject, isPlainObject } from 'is-what';

/**
 * Returns the input with circular references replaced with `'[Circular]'`.
 *
 * In strict mode (the default), only plain objects are processed.
 * Disable strict mode to potentially process objects that are
 * class instances.
 *
 * *adpated from https://gist.github.com/saitonakamura/d51aa672c929e35cc81fa5a0e31f12a9*
 */
function replaceCircular(val: any, cache = new WeakSet(), strict = true) {
  cache = cache || new WeakSet();

  const condition = (val: any) => {
    if (strict) return isPlainObject(val);
    return isObject(val);
  };

  if (condition(val)) {
    if (val.props) return '[Circular]';
    if (cache.has(val)) return '[Circular]';

    cache.add(val);

    var obj = Array.isArray(val) ? [] : {};
    for (var idx in val) {
      obj[idx] = replaceCircular(val[idx], cache);
    }

    cache.delete(val);
    return obj;
  }

  return val;
}

export { replaceCircular };
