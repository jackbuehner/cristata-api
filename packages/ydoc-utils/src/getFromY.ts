import {
  DeconstructedSchemaDefType,
  deconstructSchema,
  isTypeTuple,
  MongooseSchemaType,
} from '@jackbuehner/cristata-generator-schema';
import { get as getProperty, set as setProperty } from 'object-path';
import { transformHexToObjectId } from './utils';
import * as Y from 'yjs';
import { shared } from './shared';

interface GetYFieldsOptions {
  retainReferenceObjects?: boolean;
  keepJsonParsed?: boolean;
  hexIdsAsObjectIds?: boolean;
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

      if (schemaType === 'Boolean') {
        // arrays of booleans are not supported in the app
        if (isArray) return;

        const boolean = new shared.Boolean(ydoc);
        setProperty(data, key, boolean.get(key));
      }

      if (schemaType === 'Date') {
        // arrays of dates are not supported in the app
        if (isArray) return;

        const date = new shared.Date(ydoc);
        setProperty(data, key, new Date(date.get(key) || '0001-01-01T01:00:00.000+00:00'));
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
      }

      if (schemaType === 'Float') {
        const float = new shared.Float(ydoc);
        if (isArray || options || reference) {
          const ids = float.get(key, true).map(({ value }) => value);
          setProperty(data, key, isArray ? ids : ids[0]);
        } else {
          setProperty(data, key, float.get(key, false));
        }
      }

      if (schemaType === 'JSON') {
        // Nothing should reach here
        // because JSON fields are converted
        // to the fields they actualy represent.
        // If a value reaches here, do nothing.
        // The UI will show it as uneditable JSON.
      }

      if (schemaType === 'Number') {
        const integer = new shared.Integer(ydoc);
        if (isArray || options || reference) {
          const ids = integer.get(key, true).map(({ value }) => value);
          setProperty(data, key, isArray ? ids : ids[0]);
        } else {
          setProperty(data, key, integer.get(key, false));
        }
      }

      if (schemaType === 'ObjectId') {
        const reference = new shared.Reference(ydoc);
        const values = reference.get(key);
        if (opts?.retainReferenceObjects) {
          if (opts?.hexIdsAsObjectIds) {
            const transformed = values.map(transformHexToObjectId);
            setProperty(data, key, isArray ? transformed : transformed[0]);
          } else {
            setProperty(data, key, isArray ? values : values[0]);
          }
        } else {
          if (opts?.hexIdsAsObjectIds) {
            const ids = values.map(transformHexToObjectId).map(({ value }) => value);
            setProperty(data, key, isArray ? ids : ids[0]);
          } else {
            const ids = values.map(({ value }) => value);
            setProperty(data, key, isArray ? ids : ids[0]);
          }
        }
      }

      if (schemaType === 'String') {
        const string = new shared.String(ydoc);
        if (isArray || options || reference) {
          const ids = (await string.get(key, true, false, false)).map(({ value }) => value);
          setProperty(data, key, isArray ? ids : ids[0]);
        } else if (def.field?.markdown) {
          setProperty(data, key, await string.get(key, false, false, true));
        } else {
          setProperty(data, key, await string.get(key, false, !!def.field?.tiptap, false));
        }
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
