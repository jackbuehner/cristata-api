import {
  DeconstructedSchemaDefType,
  deconstructSchema,
  isTypeTuple,
  MongooseSchemaType,
} from '@jackbuehner/cristata-generator-schema';
import { isJSON } from '@jackbuehner/cristata-utils';
import mongoose from 'mongoose';
import { get as getProperty, set as setProperty } from 'object-path';
import * as Y from 'yjs';
import { shared } from './shared';
import { transformHexToObjectId } from './utils';

interface GetYFieldsOptions {
  retainReferenceObjects?: boolean;
  keepJsonParsed?: boolean;
  hexIdsAsObjectIds?: boolean;
  /**
   * Always replace undefined or null values with the default value.
   * The default value is defined in the schema.
   *
   * Empty arrays are not replaced. Array types will always provide
   * an empty array if there is no value.
   *
   * __Defaults:__ \
   * Boolean: `false` \
   * Date: `new Date('0001-01-01T01:00:00.000+00:00')` (always replaced) \
   * DocArray: `[]` \
   * Float: `0` \
   * Number: `0` \
   * ObjectId: `'000000000000000000000000' | ObjectId('000000000000000000000000')` \
   * String: `''`
   */
  replaceUndefinedNull?: boolean;
}

async function getFromY(ydoc: Y.Doc, _schemaDef: DeconstructedSchemaDefType, opts?: GetYFieldsOptions) {
  const schemaDef = JSON.parse(JSON.stringify(_schemaDef)) as DeconstructedSchemaDefType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  const JSONFields = schemaDef.filter(([, def]) => def.type === 'JSON');

  await Promise.all(
    schemaDef.map(async ([key, def]) => {
      const [schemaType, isArray] = (() => {
        const schemaType: MongooseSchemaType | 'DocArray' = isTypeTuple(def.type) ? def.type[1] : def.type;
        const isArrayType = Array.isArray(schemaType);

        if (isArrayType) return [schemaType[0], true];
        return [schemaType, false];
      })();

      const options = def.field?.options as unknown as
        | { value: string | number; label: string; disabled?: boolean }[]
        | undefined;

      const reference = def.field?.reference;

      const required = def.required;
      const defaultValue = def.default;

      if (schemaType === 'ObjectId' || def.field?.reference?.collection) {
        // shared type helper
        const reference = new shared.Reference(ydoc);

        // get the value
        type ToSetObj = { value: string | mongoose.Types.ObjectId; label: string };
        type ToSet = ToSetObj[] | (string | mongoose.Types.ObjectId)[];
        let toSet: ToSet = reference
          .get(key)
          .map((obj): ToSetObj => ({ value: `${obj.value}`, label: `${obj.label || obj.value}` }));

        // transform hex ids to object ids
        const shouldTransform =
          opts?.hexIdsAsObjectIds === true &&
          (def.field?.reference?.fields?._id === '_id' || !def.field?.reference?.fields?._id) &&
          schemaType === 'ObjectId';
        if (shouldTransform) {
          toSet = toSet.map(transformHexToObjectId);
        }

        // reduce reference objects to ids array
        if (opts?.retainReferenceObjects !== true) {
          toSet = toSet.map(({ value }) => value);
        }

        // set default value
        if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
          if (isArray) toSet = [];
          else if (shouldTransform) toSet = [new mongoose.Types.ObjectId('000000000000000000000000')];
          else toSet = [''];
        }

        // set value in return data
        setProperty(data, key, isArray ? toSet : toSet[0]);

        return;
      }

      if (schemaType === 'Boolean') {
        // arrays of booleans are not supported in the app
        if (isArray) return;

        // shared type helper
        const boolean = new shared.Boolean(ydoc);

        // get the value
        let toSet = boolean.get(key);
        if (!toSet && (required || opts?.replaceUndefinedNull)) {
          if (defaultValue === true || defaultValue === 'true' || defaultValue === 1) {
            toSet = true;
          } else {
            toSet = false;
          }
        }

        // set value in return data
        setProperty(data, key, toSet);

        return;
      }

      if (schemaType === 'Date') {
        // arrays of dates are not supported in the app
        if (isArray) return;

        // shared type helper
        const date = new shared.Date(ydoc);

        // get the value
        let toSet = date.get(key);
        if (!toSet && (isNaN(Date.parse(toSet)) || required || opts?.replaceUndefinedNull)) {
          if (typeof defaultValue === 'string' && !isNaN(Date.parse(defaultValue))) {
            toSet = defaultValue;
          } else {
            toSet = '0001-01-01T01:00:00.000+00:00';
          }
        }

        // set value in return data
        setProperty(data, key, new Date(toSet));

        return;
      }

      if (schemaType === 'DocArray') {
        const array = new shared.DocArray(ydoc);

        // get the value of the shared type as an array of objects
        let arrayValue: Record<string, unknown>[] = [];
        if (def.docs) {
          const namedSubdocSchemas = def.docs.filter(([docKey]) => !docKey.includes('#'));
          arrayValue = await array.get(key, { opts, schema: namedSubdocSchemas });
        } else {
          arrayValue = await array.get(key);
        }

        // remove the uuid
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        arrayValue = arrayValue.map(({ __uuid, ...rest }) => rest);

        // insert the value of this field into the data object that
        // is returned by this function
        setProperty(data, key, arrayValue);

        return;
      }

      if (schemaType === 'Float') {
        // shared type helper
        const float = new shared.Float(ydoc);

        if (isArray || !!options || !!reference) {
          // get the value
          let toSet = float.get(key, true).map(({ value }) => value);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'number') {
              toSet = [defaultValue];
            } else if (
              Array.isArray(defaultValue) &&
              (defaultValue as unknown[]).every((val) => typeof val === 'number')
            ) {
              toSet = defaultValue as number[];
            } else {
              toSet = [];
            }
          }

          // set value in return data
          setProperty(data, key, isArray ? toSet : toSet[0]);
        } else {
          // get the value
          let toSet = float.get(key, false);

          // set default value
          if (!toSet && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'number') {
              toSet = defaultValue;
            } else {
              toSet = 0;
            }
          }

          // set value in return data
          setProperty(data, key, toSet);
        }

        return;
      }

      if (schemaType === 'JSON') {
        // Nothing should reach here
        // because JSON fields are converted
        // to the fields they actualy represent.
        // If a value reaches here, do nothing.
        // The UI will show it as uneditable JSON.
        return;
      }

      if (schemaType === 'Number') {
        // shared type helper
        const integer = new shared.Integer(ydoc);

        if (isArray || !!options || !!reference) {
          // get the value
          let toSet = integer.get(key, true).map(({ value }) => value);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'number') {
              toSet = [defaultValue];
            } else if (
              Array.isArray(defaultValue) &&
              (defaultValue as unknown[]).every((val) => typeof val === 'number')
            ) {
              toSet = defaultValue as number[];
            } else {
              toSet = [];
            }
          }

          // set value in return data
          setProperty(data, key, isArray ? toSet : toSet[0]);
        } else {
          // get the value
          let toSet = integer.get(key, false);

          // set default value
          if (!toSet && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'number') {
              toSet = defaultValue;
            } else {
              toSet = 0;
            }
          }

          // set value in return data
          setProperty(data, key, toSet);
        }

        return;
      }

      if (schemaType === 'String') {
        // shared type helper
        const string = new shared.String(ydoc);

        // options/array
        if (isArray || options || reference) {
          // get the value
          let toSet = (await string.get(key, true, false, false)).map(({ value }) => `${value}`);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (isArray) {
              if ((defaultValue as unknown[]).every((val) => typeof val === 'string'))
                toSet = defaultValue as string[];
              else toSet = [];
            } else {
              if (typeof defaultValue === 'string') toSet = [defaultValue];
              else toSet = [''];
            }
          }

          // set value in return data
          setProperty(data, key, isArray ? toSet : toSet[0]);
        }

        // markdown
        else if (def.field?.markdown) {
          // get the value
          let toSet = await string.get(key, false, false, true);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'string') toSet = defaultValue;
            else toSet = '';
          }

          // set value in return data
          setProperty(data, key, toSet);
        }

        // rich text
        else if (def.field?.tiptap) {
          // get the value
          let toSet = await string.get(key, false, true, false);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'string' && isJSON(toSet) && Array.isArray(JSON.parse(toSet)))
              toSet = defaultValue;
            else toSet = '[]';
          }

          // set value in return data
          setProperty(data, key, toSet);
        }

        // regular text
        else {
          // get the value
          let toSet = await string.get(key, false, false, false);

          // set default value
          if ((!toSet || toSet.length === 0) && (required || opts?.replaceUndefinedNull)) {
            if (typeof defaultValue === 'string') toSet = defaultValue;
            else toSet = '';
          }

          // set value in return data
          setProperty(data, key, toSet);
        }

        return;
      }
    })
  );

  await Promise.all(
    JSONFields.map(async ([key, def]) => {
      // find the set of fields that are meant for this specific document
      // by finding a matching name or name === 'default'
      const match =
        def.field?.custom?.find(({ name }) => name === data['name']) || // TODO: support any name field
        def.field?.custom?.find(({ name }) => name === 'default');

      // push the matching subfields onto the schemaDef variable
      // so that they can have a shared type created
      if (match) {
        const defs = deconstructSchema(match.fields, key);
        const values = await getFromY(ydoc, defs, opts);
        defs.forEach(([subvalueKey]) => {
          // set the data for each key
          setProperty(data, subvalueKey, getProperty(values, subvalueKey));
        });
        setProperty(data, '__toJSON.' + key, true);
      }

      // stringify the JSON field values
      if (!opts?.keepJsonParsed && !match) {
        setProperty(data, key, JSON.stringify(getProperty(data, key)));
      }
    })
  );

  return data;
}

export { getFromY };
export type { GetYFieldsOptions };
