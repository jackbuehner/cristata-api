import { FieldDef } from '@cristata/generator-schema';
import { Model } from 'mongoose';
import * as Y from 'yjs';

type UnpopulatedValue = { _id: string; label?: string; [key: string]: unknown };
type PopulatedValue = { value: string; label: string; [key: string]: unknown };

/**
 * Reference fields are stored as an
 * array of objects containing a value,
 * label, and other optional metadata.
 *
 * The shared array if used for both single
 * references and arrays of references. The
 * UI clears the existing array values
 * when selecting on option in a field that
 * only allows one selection.
 */
class YReference<
  K extends string,
  V extends (string | undefined | null)[] | UnpopulatedValue[] | undefined | null
> {
  #ydoc: Y.Doc;

  constructor(ydoc: Y.Doc) {
    this.#ydoc = ydoc;
  }

  async set<T>(
    key: K,
    value: V,
    /**
     * A function that gets a model from it's name.
     *
     *
     * You should use the `TenantDB.model` function.
     * Connect the database before providing the model function
     * with `await tenantDB.connect()`.
     */
    TenantModel: (name: string) => Promise<Model<T> | null>,
    reference?: FieldDef['reference']
  ): Promise<Record<string, unknown>[]> {
    // get/create the shared type
    const type = this.#ydoc.getArray<Record<string, unknown>>(key);

    // convert all values into partially populated values
    const partiallyPopulated: UnpopulatedValue[] = [];

    value?.forEach((v) => {
      if (!v) return;
      if (typeof v === 'string') {
        partiallyPopulated.push({ _id: v });
      } else {
        partiallyPopulated.push({
          ...v,
          _id: (v[reference?.fields?._id || '_id'] as string | undefined) || v._id,
          label: (v[reference?.fields?.name || 'name'] as string | undefined) || v.label,
        });
      }
    });

    // populate unpopulated values by querying the database for the name field
    const populated: PopulatedValue[] = [];

    await Promise.all(
      partiallyPopulated.map(async (v) => {
        if (reference?.collection) {
          if (v._id && v.label) {
            populated.push({ ...v, value: v._id, label: v.label });
          } else {
            const Model = await TenantModel(reference.collection);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = (await Model?.findById(v._id)) as any;
            if (found) {
              populated.push({ ...v, value: v._id, label: found[reference.fields?.name || 'name'] });
            } else {
              populated.push({ ...v, value: v._id, label: v._id });
            }
          }
        }
      })
    );

    this.#ydoc.transact(() => {
      // clear existing values
      type.delete(0, type.toArray()?.length);
      this.#deleteDocFieldShares(key);

      // push the populated values
      type.push(
        populated.map(({ value, label, ...rest }) => {
          return { value, label, ...rest };
        })
      );
    });

    // return the new value
    return type.toArray();
  }

  has(key: K): boolean {
    return this.#ydoc.share.has(key);
  }

  get(key: K): Record<string, 'value' | 'label' | unknown>[] {
    return this.#ydoc.getArray<Record<string, 'value' | 'label' | unknown>>(key).toArray();
  }

  delete(key: K): void {
    this.#ydoc.share.delete(key);
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

export { YReference };