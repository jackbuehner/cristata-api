import { DeconstructedSchemaDefType } from '@jackbuehner/cristata-generator-schema';
import { getFromY, GetYFieldsOptions } from '../getFromY';
import { get as getProperty, set as setProperty } from 'object-path';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';

/**
 * DocArrays are stored in a yjs shared array. The value
 * of each doc is an object with keys, and we store
 * each object in the shared array. *There is no validation
 * of the object contents.*
 *
 * DocArray children are fields that may create their own
 * shared type. These are always prefixed with
 * `__docArray.‾‾KEY‾‾.`, where `KEY` is the key of the doc array.
 * These need to be deleted when we are setting the doc array
 * so there are no leftover usused shared types.
 *
 * To ensure the DocArray children can be uniquely
 * identified, we also inject a uuid into each object
 * in the shared array.
 */
class YDocArray<K extends string, V extends Record<string, unknown>[]> {
  #ydoc: Y.Doc;

  constructor(ydoc: Y.Doc) {
    this.#ydoc = ydoc;
  }

  set(key: K, value: V): [Record<string, unknown>[], string[]] {
    // get/create the shared type
    const type = this.#ydoc.getArray<Record<string, unknown>>(key);

    // track the generated uuids so we can create types
    // for the fields in each doc
    const generatedUuids: string[] = [];

    this.#ydoc.transact(() => {
      // clear existing value
      type.delete(0, type.toArray()?.length);
      this.#deleteDocFieldShares(key);

      // push each doc into the shared type
      type.push(
        value.map((rest) => {
          const __uuid = uuidv4();
          generatedUuids.push(__uuid);
          return { ...rest, __uuid };
        })
      );
    });

    // return the new value and the uuids that were generated
    return [type.toArray(), generatedUuids];
  }

  has(key: K): boolean {
    return this.#ydoc.share.has(key);
  }

  async get(
    key: K,
    populate?: { schema: DeconstructedSchemaDefType; opts?: GetYFieldsOptions }
  ): Promise<Record<string, unknown>[]> {
    const type = this.#ydoc.getArray<Record<string, unknown> & { uuid: string }>(key);
    const arr = type.toArray();

    if (populate) {
      await Promise.all(
        arr.map(async ({ __uuid }, index) => {
          // create the schema for that will allow us to get the field
          // values of the the properies inside the object at this index
          const defs = populate.schema
            .filter(([docKey]) => !docKey.includes('#'))
            .map(([docKey, docDef]): typeof populate.schema[0] => {
              const docArrayKey = docKey.replace(key, `__docArray.‾‾${key}‾‾.${__uuid}`);
              return [docArrayKey, docDef];
            });

          // get the field data for the object at this index
          const data = await getFromY(this.#ydoc, defs, populate.opts);

          // get the object with data to use for this index
          const obj = getProperty(data, `__docArray.‾‾${key}‾‾.${__uuid}`);

          // set the object at this index
          setProperty(arr, index, obj);
        })
      );
    }

    return arr;
  }

  delete(key: K): void {
    this.#ydoc.share.delete(key);
    this.#deleteDocFieldShares(key);
  }

  /**
   * remove shared types that were created as a result
   * of this docArray
   */
  #deleteDocFieldShares(key: K) {
    this.#ydoc.share.forEach((share, shareName) => {
      if (shareName.includes(`__docArray.‾‾${key}‾‾.`)) {
        this.#ydoc.share.delete(shareName);
      }
    });
  }
}

export { YDocArray };
