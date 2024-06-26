import { RichKit, StringKit } from '@jackbuehner/cristata-tiptap';
import { hasKey } from '@jackbuehner/cristata-utils';
import { JSDOM } from 'jsdom';
import * as Y from 'yjs';
import { getTipTapEditorJson } from './getTipTapEditorJson';
import { setTipTapXMLFragment } from './setTipTapXMLFragment';

const { document } = new JSDOM(``).window;

type Option = { value: string | number; label: string; disabled?: boolean };

/**
 * Strings are stored in a shared XML Fragment.
 * Fields in the UI are powered by TipTap.
 * TpTap will add XML tags as needed, so we just
 * need to set the fragment value.
 *
 * When strings are in an array, they are stored
 * in a shared array of objects containing a
 * value, label, and other optional metadata.
 */
class YString<K extends string, V extends string | undefined | null> {
  #ydoc: Y.Doc;

  constructor(ydoc: Y.Doc) {
    this.#ydoc = ydoc;
  }

  set(key: K, value: V, opt1?: 'code'): string;
  set(key: K, value: V, opt1?: 'tiptap'): string;
  set(key: K, value: V[], opt1?: Option[]): Option[];
  set(key: K, value: V | V[], opt1?: Option[] | 'code' | 'tiptap'): string | Option[] {
    const options = Array.isArray(opt1) ? opt1 : undefined;
    const isRichText = opt1 === 'tiptap';
    const isCode = opt1 === 'code';

    if (Array.isArray(value)) {
      // get/create the shared type
      const type = this.#ydoc.getArray<Option>(key);

      // clear existing values
      type.delete(0, type.toArray()?.length);

      // push new values
      type.push(
        value
          .filter((str): str is NonNullable<V> => !!str)
          .map((str) => {
            // use value of option that matches `value`
            // if there is a match
            const matchingOption = options?.find((opt) => opt.value.toString() === str);
            return matchingOption || { value: str, label: str };
          })
      );

      return type.toArray();
    }

    if (isCode) {
      // get/create the shared type
      const type = this.#ydoc.getText(key);

      // clear existing values
      type.delete(0, type.length);

      // set new values
      type.insert(0, value || '');

      return type.toJSON();
    }

    return setTipTapXMLFragment(
      key,
      value,
      this.#ydoc,
      isRichText ? [RichKit.configure({ history: false })] : [StringKit]
    );
  }

  has(key: K): boolean {
    return this.#ydoc.share.has(key);
  }

  async get(key: K, isArray: false, isRichText: boolean, isCode: boolean): Promise<string>;
  async get(key: K, isArray: true, isRichText: false, isCode: false, options?: Option[]): Promise<Option[]>;
  async get(
    key: K,
    isArray: boolean,
    isRichText: boolean,
    isCode: boolean,
    options?: Option[]
  ): Promise<string | Option[]> {
    if (isArray) {
      const found = this.#ydoc.getArray<Option | string | Y.XmlElement>(key).toArray();

      const resolved = found.map((value): Option | undefined | null => {
        // plain string
        if (typeof value === 'string') {
          if (options) return options.find((opt) => opt.value === value);
          return { value, label: value };
        }

        // existing option
        if (hasKey('value', value) && hasKey('label', value)) {
          return value;
        }

        // YXMLFragment
        const textContent = value.toDOM(document).textContent;
        if (textContent) {
          if (options) return options.find((opt) => opt.value === textContent);
          return { value: textContent, label: textContent };
        }

        return undefined;
      });

      return resolved.filter((elem): elem is Option => !!elem);
    }

    if (isRichText) return await getTipTapEditorJson(key, this.#ydoc);
    if (isCode) return this.#ydoc.getText(key).toJSON();
    return this.#ydoc.getXmlFragment(key).toDOM(document).textContent || '';
  }

  delete(key: K): void {
    this.#ydoc.share.delete(key);
  }
}

export { YString };
