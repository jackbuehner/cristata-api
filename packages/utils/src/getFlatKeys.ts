import { isObject } from 'is-what';

function getFlatKeys(obj: Record<string, unknown>) {
  const keys: string[] = [];

  const walk = (o: Record<string, unknown>, parent: string | null = null) => {
    for (const k in o) {
      const current = parent ? parent + '.' + k : k;

      if (isObject(o) && isObject(o[k])) {
        walk(o[k], current);
      } else {
        keys.push(current);
      }
    }
  };

  walk(obj);

  return keys;
}

export { getFlatKeys };
