import { IntegerKit } from '@jackbuehner/cristata-tiptap';
import { hasKey } from '@jackbuehner/cristata-utils';
import { JSDOM } from 'jsdom';
import * as Y from 'yjs';
import { setTipTapXMLFragment } from './setTipTapXMLFragment';

const { document } = new JSDOM(``).window;

type Option<T> = { value: T; label: string; disabled?: boolean };

/**
 * Numbers are stored in a shared XML Fragment.
 * Fields in the UI are powered by TipTap.
 * TipTap will add XML tags as needed, so we just
 * set the fragment value to a stringified integer.
 *
 * When integers are in an array, they are stored
 * in a shared array of objects containing a
 * value, label, and other optional metadata.
 */
class YInteger<K extends string, V extends number | undefined | null> {
  #ydoc: Y.Doc;

  constructor(ydoc: Y.Doc) {
    this.#ydoc = ydoc;
  }

  set(key: K, value: V): string;
  set(key: K, value: V[], opt1?: Option<string | number>[]): Option<string | number>[];
  set(key: K, value: V | V[], opt1?: Option<string | number>[] | boolean): string | Option<string | number>[] {
    const options = Array.isArray(opt1) ? opt1 : undefined;

    if (Array.isArray(value)) {
      // get/create the shared type
      const type = this.#ydoc.getArray<Option<string | number>>(key);

      // clear existing values
      type.delete(0, type.toArray()?.length);

      // push new values
      type.push(
        value
          .filter((int): int is NonNullable<V> => !!int)
          .map((int) => {
            // use value of option that matches `value` if there is a match
            const matchingOption = options?.find((opt) => opt.value.toString() === int.toString());
            return matchingOption || { value: int.toString(), label: int.toString() };
          })
      );

      return type.toArray();
    }

    return setTipTapXMLFragment(key, value?.toString(), this.#ydoc, [IntegerKit]);
  }

  has(key: K): boolean {
    return this.#ydoc.share.has(key);
  }

  get(key: K, isArray: false): number;
  get(key: K, isArray: true, options?: Option<string | number>[]): Option<number>[];
  get(key: K, isArray: boolean, options?: Option<string | number>[]): number | Option<number>[] {
    if (isArray) {
      const found = this.#ydoc.getArray<Option<number> | Y.XmlElement>(key).toArray();

      const resolved = found.map((value): Option<string | number> | undefined | null => {
        // existing option
        if (hasKey('value', value) && hasKey('label', value)) {
          return value;
        }

        // YXMLFragment
        const textContent = value.toDOM(document).textContent;
        if (textContent) {
          if (options)
            return options
              .filter((opt): opt is Option<number> => typeof opt.value === 'number')
              .find((opt) => opt.value === parseInt(textContent));
          return { value: parseInt(textContent), label: `${parseInt(textContent)}` };
        }

        return undefined;
      });

      return resolved
        .filter((elem): elem is Option<string | number> => !!elem)
        .map(({ value, ...rest }) => ({ value: parseInt(`${value}`), ...rest }));
    }

    return parseInt(this.#ydoc.getXmlFragment(key).toDOM(document).textContent || '');
  }

  delete(key: K): void {
    this.#ydoc.share.delete(key);
  }
}

export { YInteger };
