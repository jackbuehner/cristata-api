import { FieldDef } from '@jackbuehner/cristata-generator-schema';
import { merge } from 'merge-anything';
import { Model, RootQuerySelector } from 'mongoose';
import * as Y from 'yjs';
import { get as getProperty, set as setProperty } from 'object-path';
import { getFlatKeys } from '@jackbuehner/cristata-utils';

type UnpopulatedValue = { _id: string; label?: string; [key: string]: unknown };
type PopulatedValue = { value: string; label: string; [key: string]: unknown };

type FilterQuery = RootQuerySelector<Record<string, unknown>>;

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
    reference?: FieldDef['reference'],
    updateReferencesMode?: boolean
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
          _id: (getProperty(v, reference?.fields?._id || '_id') as string | undefined) || v._id,
          label: (getProperty(v, reference?.fields?.name || 'name') as string | undefined) || v.label,
        });
      }
    });

    // populate unpopulated values by querying the database for the name field
    const populated = (
      await Promise.all(
        partiallyPopulated.map(async (v): Promise<PopulatedValue | undefined> => {
          if (reference?.collection) {
            if (v._id && v.label) {
              return { ...v, value: v._id, label: v.label };
            } else {
              const Model = await TenantModel(reference.collection);

              const requirementFilter: FilterQuery = merge(
                {},
                ...(reference.require || []).map((fieldName): FilterQuery => {
                  return {
                    $and: [
                      { [fieldName]: { $exists: true } },
                      { [fieldName]: { $ne: '' } },
                      { [fieldName]: { $ne: null } },
                    ],
                  };
                })
              );

              const found = (await Model?.findOne({
                $and: [
                  { [reference.fields?._id || '_id']: v._id },
                  { ...reference.filter },
                  { ...requirementFilter },
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }).then((res) => res?.toObject())) as any;

              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { value, label, _id, ...rest } = v;
              if (found) {
                // get fields that are forced to be included
                const forced: Record<string, unknown> = {};
                [...(reference.forceLoadFields || []), ...(reference.require || [])].map((fieldName) => {
                  setProperty(forced, fieldName, getProperty(found, fieldName) || null);
                });

                return {
                  value: _id,
                  label: getProperty(found, reference.fields?.name || 'name'),
                  ...rest,
                  ...forced,
                };
              }
            }
          }
        })
      )
    ).filter((x): x is PopulatedValue => !!x);

    // if in update mode, look through each reference objects
    // and only replace outdated reference objects (e.g. if a name changes)
    if (updateReferencesMode) {
      const current = this.get(key);

      // build an object of objects to be replaced in the shared type
      const toReplace: Record<number, PopulatedValue> = {};
      populated.forEach((pv, index) => {
        // get the flattened keys (e.g. `parent.child`)
        const flatKeys = getFlatKeys(pv);

        // for each key, compare the current and correct value
        // and record if an object has and outdate property value
        flatKeys.forEach((flatKey) => {
          const populatedValue = getProperty(pv, flatKey);
          const currentValue = getProperty(current[index], flatKey);

          if (populatedValue !== currentValue && index < current.length) {
            toReplace[index] = pv;
          }
        });
      });

      // replace all objects that had stale properties
      this.#ydoc.transact(() => {
        this.#deleteDocFieldShares(key);
        Object.entries(toReplace).forEach(([_index, value]) => {
          const index = parseInt(_index);
          type.delete(index);
          type.insert(index, [value]);
        });
      });

      return type.toArray();
    }

    // in normal mode, delete the entire array
    // and create all-new values
    this.#ydoc.transact(() => {
      // clear existing values
      type.delete(0, type.toArray()?.length);
      this.#deleteDocFieldShares(key);

      // push the populated values
      if (populated.length > 0 || reference?.collection) {
        type.push(
          populated.map(({ value, label, ...rest }) => {
            return { value, label, ...rest };
          })
        );
      }

      // or fallback to partially populated values
      else {
        type.push(
          partiallyPopulated.map(({ _id, label, ...rest }) => {
            return { value: _id, label: label || _id, ...rest };
          })
        );
      }
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
