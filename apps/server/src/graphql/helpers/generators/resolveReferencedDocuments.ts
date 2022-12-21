import {
  DeconstructedSchemaDefType,
  deconstructSchema,
  defaultSchemaDefTypes,
  isTypeTuple,
  MongooseSchemaType,
  SchemaDefType,
} from '@jackbuehner/cristata-generator-schema';
import {
  countSubstringOccurance,
  flattenObject,
  getPropertyInArray,
  isObjectId,
} from '@jackbuehner/cristata-utils';
import { UserInputError } from 'apollo-server-core';
import { copy } from 'copy-anything';
import getFieldNames from 'graphql-list-fields';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { get as getProperty, set as setProperty } from 'object-path';
import { CollectionDoc } from '..';
import { TenantDB } from '../../../mongodb/TenantDB';
import { Collection } from '../../../types/config';
import { Context } from '../../server';
import { createProjection } from './createProjection';

type Info = Parameters<typeof getFieldNames>[0];

function getFullSchema(collection: Collection) {
  return merge<SchemaDefType, SchemaDefType[]>(
    collection.schemaDef || {},
    defaultSchemaDefTypes.standard,
    collection.canPublish ? defaultSchemaDefTypes.publishable : {},
    collection.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
  );
}

type ObjectIdFieldsType = [string, 'ObjectId', string, boolean, Record<string, 1>, ObjectIdFieldsType[]];

/**
 * Returns details for the fields in a deconstructed schema that are ObjectIds (references).
 *
 * Details include key, type, reference collection name,
 * whether it is an array field, a projection,
 * and any children ObjectID fields for the referenced collection
 * that are included in the full projection.
 */
function getObjectIdFields(
  deconstructedSchema: DeconstructedSchemaDefType,
  context: Context,
  fullProjection: Record<string, 1> = {},
  options?: { includeAll?: boolean },
  level = 0
): ObjectIdFieldsType[] {
  const rootFields: ObjectIdFieldsType[] = deconstructedSchema
    .map(typesFromSchema)
    .flat(1)
    .filter(isObjectIdType)
    .map(([key, schemaType, collectionName, isArray]): ObjectIdFieldsType => {
      const fields = Object.keys(fullProjection)
        .filter((field) => field.indexOf(key + '.') === 0)
        .map((field) => field.replace(key + '.', ''));

      // ! this needs to occur before generating the projection
      // ! because it mutates the `fields` array
      const children = buildChildrenFields(context, collectionName, fields, level);

      // generate a projection for each reference
      const fieldProjection: Record<string, 1> = {};
      fields.forEach((field) => {
        fieldProjection[field] = 1;
      });

      return [key, schemaType, collectionName, isArray, fieldProjection, children];
    })
    .filter(([key]) => {
      if (options?.includeAll === true) return true;

      // determine the fields included by the projection
      const projectionInclusionFields = Object.entries(fullProjection)
        .filter(([, value]) => value === 1)
        .map(([key]) => key);

      // whether this field is included in the projection for the document
      const isInProjection = projectionInclusionFields.some((field) => field.indexOf(key) === 0);
      return isInProjection;
    });

  return rootFields;
}

function getObjectIdFieldInfoAndCollectionSchema(
  context: Context,
  collectionName: string
): [[string, 'ObjectId', string, boolean][], DeconstructedSchemaDefType | undefined] {
  const collection = context.config.collections.find((col) => col.name === collectionName);

  if (collection) {
    const colSchema = getFullSchema(collection);
    const colDeconstructedSchema = deconstructSchema(colSchema);

    return [colDeconstructedSchema.map(typesFromSchema).flat().filter(isObjectIdType), colDeconstructedSchema];
  }

  return [[], undefined];
}

/**
 * note: this mutates the fields parameter
 *
 * it returns the children fields
 * @param context
 * @param collectionName
 * @param fields
 * @returns
 */
function buildChildrenFields(
  context: Context,
  collectionName: string,
  fields: string[],
  level = 0
): ObjectIdFieldsType[] {
  const [referenceFieldKeysAndCollections, colDeconstructedSchema] = getObjectIdFieldInfoAndCollectionSchema(
    context,
    collectionName
  );
  if (!colDeconstructedSchema) return [];

  // determine the projection to use for populating the reference
  // and fix the parent doc reference to not attempt to get reference doc fields
  const referenceProjection: Record<
    string,
    { collectionName: string; isArray: boolean; projection: Record<string, 1> }
  > = {};
  fields.forEach((field, index) => {
    referenceFieldKeysAndCollections.forEach(([refFieldKey, , refFieldCollection, isArray]) => {
      if (field.indexOf(refFieldKey + '.') === 0) {
        // build a projection object for the reference field document
        if (!referenceProjection[refFieldKey])
          referenceProjection[refFieldKey] = {
            collectionName: refFieldCollection,
            isArray,
            projection: {},
          };
        referenceProjection[refFieldKey].projection[field.replace(refFieldKey + '.', '')] = 1;

        // also make sure that the projection field directly includes the field with the _id or _ids of the referenced documents
        const [referenceFieldKeysAndCollections] = getObjectIdFieldInfoAndCollectionSchema(
          context,
          refFieldCollection
        );
        referenceFieldKeysAndCollections.forEach(([e]) => {
          if (field.replace(refFieldKey + '.', '').indexOf(e + '.') === 0) {
            referenceProjection[refFieldKey].projection[e] = 1;
          }
        });

        // ensure that the fields used in the projection do not attempt to access
        // fields in the reference document because mongodb only has access to the
        // _id or _ids (not the entire referenced document)
        fields[index] = refFieldKey;
      }
    });
  });

  const children: ObjectIdFieldsType[] = [];
  Object.entries(referenceProjection).forEach(([refField, { collectionName, isArray, projection }]) => {
    const res = getObjectIdFields(colDeconstructedSchema, context, projection, {}, level + 1);
    children.push([refField, 'ObjectId', collectionName, isArray, projection, res]);
  });

  return children;
}

function typesFromSchema([key, def]: DeconstructedSchemaDefType[0]): [
  string,
  MongooseSchemaType | 'DocArray',
  string | null,
  boolean
][] {
  const [schemaType, collectionName, isArray] = (() => {
    const schemaType: MongooseSchemaType | 'DocArray' = isTypeTuple(def.type) ? def.type[1] : def.type;
    const collectionName = isTypeTuple(def.type) ? def.type[0] : null;
    const isArrayType = Array.isArray(schemaType);

    if (isArrayType) return [schemaType[0], collectionName?.slice(1, -1) || null, true];
    return [schemaType, collectionName, false];
  })();

  // support defs in schema for doc arrays by including it in the array of type information arrays
  if (schemaType === 'DocArray' && def.docs) {
    const typesFromArrayOfDefs = def.docs.map((d) => typesFromSchema(d)).flat();
    return [[key, schemaType, collectionName, isArray], ...typesFromArrayOfDefs];
  }

  return [[key, schemaType, collectionName, isArray]];
}

function isObjectIdType(v: ReturnType<typeof typesFromSchema>[0]): v is [string, 'ObjectId', string, boolean] {
  const [, schemaType, collectionName] = v;
  return !!(schemaType === 'ObjectId' && collectionName);
}

/**
 * Resolves reference documents (children documents).
 * Supports schema defs, nested schema defs, and doc array schemas.
 *
 * __This mutates the input documents.__
 */
async function resolveReferencedDocuments(
  _docs: CollectionDoc[],
  info: Info,
  context: Context,
  collectionName: string
): Promise<CollectionDoc[]> {
  const docs = copy(_docs);

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const collection = context.config.collections.find((col) => col.name === collectionName);
  if (!collection) {
    return docs;
  }

  const fullSchema = getFullSchema(collection);
  const deconstructedSchema = deconstructSchema(fullSchema);

  // get projections
  const projectionConfig = {
    canPublish: collection.canPublish || false,
    schemaDef: collection.schemaDef,
    withPermissions: collection.withPermissions || false,
  };
  const projection = createProjection(info, projectionConfig);
  const fullProjection = createProjection(info, projectionConfig, { keepReferenceFields: true });

  // determine the names of the fields in the projection that are references/objectids
  const objectIdFields = getObjectIdFields(deconstructedSchema, context, fullProjection, projection);
  const promises: Record<string, Promise<Record<string, unknown> | null> | undefined> = {};

  await Promise.all(
    docs.map((doc) => {
      return Promise.all(objectIdFields.map((v) => resolveReferencedDocument(promises, tenantDB, doc, v)));
    })
  );

  return docs;
}

async function resolveReferencedDocument(
  promises: Record<string, Promise<Record<string, unknown> | null> | undefined>,
  tenantDB: TenantDB,
  doc: CollectionDoc,
  [key, , collectionName, isArray, project, children]: ObjectIdFieldsType
): Promise<void> {
  // get the model from the type
  const Model = await tenantDB.model(collectionName);
  if (!Model) return;

  // determine if only _id is needed (per the projection)
  const isOnlyId = (() => {
    const keys = Object.keys(project);
    return keys.length === 1 && keys[0] === '_id';
  })();

  const [identifier, determinedKey] = getPropertyInArray(doc, key);
  if (countSubstringOccurance(determinedKey, '$') > 1) {
    throw new UserInputError('resolving children in nested document arrays is not supported');
  }

  if (isArray || Array.isArray(identifier)) {
    // get the _ids from the document
    if (!Array.isArray(identifier) || !identifier.every((_id) => isObjectId(_id))) return;
    const _ids = identifier.map((_id) => new mongoose.Types.ObjectId(_id));

    _ids.forEach((_id, index) => {
      // if we only need the _id, we do not need a query
      if (isOnlyId) {
        if (determinedKey.includes('$')) {
          setProperty(doc, determinedKey.replace('$', index.toString()), { _id });
        } else {
          setProperty(doc, key + '.' + index, { _id });
        }
        console.log(JSON.stringify(doc));
        return;
      }

      // create an identifier that includes collection, id, and projection information
      const promiseKey = `${collectionName}.${_id}.${Object.keys(removePathCollision(project)).join('%%')}`;

      // determine if there is an existing promise that is compatable
      const [matchingPromiseKey, matchingPromise] = Object.entries(promises).find(([key]) => {
        const [otherCollectionName, other_id, projectString] = key.split('.');
        const projectStringKeys = projectString.split('%%');

        // require collection names and document ids to match
        if (otherCollectionName !== collectionName) return false;
        if (_id.toHexString() !== other_id) return false;

        // compatable promises must include every key required by the projection (and may contain extra keys)
        return Object.keys(project).every((key) => projectStringKeys.includes(key));
      }) || ['', null];

      // use the compatable promise instead so there are fewer database queries
      if (matchingPromise) {
        if (determinedKey.includes('$')) {
          setProperty(doc, determinedKey.replace('$', index.toString()), promises[matchingPromiseKey]);
        } else {
          setProperty(doc, key + '.' + index, promises[matchingPromiseKey]);
        }
        return;
      }

      // create a promise for the document
      promises[promiseKey] = Model.findById(_id, removePathCollision(project))
        .then(async (doc) => {
          if (doc) {
            // convert the document to a plain object
            const _doc = doc.toObject() as CollectionDoc;

            // inject promises to resolve for all nested children
            await Promise.all(
              children.map(async (child) => {
                return resolveReferencedDocument(promises, tenantDB, _doc, child);
              })
            );

            // return the doc with the promises
            return _doc;
          }
          return null;
        })
        .catch((err) => {
          console.error(err);
          return null;
        });

      // set the value to the promise for the document
      if (determinedKey.includes('$')) {
        setProperty(doc, determinedKey.replace('$', index.toString()), promises[promiseKey]);
      } else {
        setProperty(doc, key + '.' + index, promises[promiseKey]);
      }
      return;
    });

    return;
  }

  // get the id from the document
  const _id = identifier;
  if (!isObjectId(_id)) return;

  // if we only need the _id, we do not need a query
  if (isOnlyId) {
    setProperty(doc, key, { _id });
    return;
  }

  // create an identifier that includes collection, id, and projection information
  const promiseKey = `${collectionName}.${_id}.${Object.keys(removePathCollision(project)).join('%%')}`;

  // determine if there is an existing promise that is compatable
  const [matchingPromiseKey, matchingPromise] = Object.entries(promises).find(([key]) => {
    const [otherCollectionName, other_id, projectString] = key.split('.');
    const projectStringKeys = projectString.split('%%');

    // require collection names and document ids to match
    if (otherCollectionName !== collectionName) return false;
    if (_id !== other_id) return false;

    // compatable promises must include every key required by the projection (and may contain extra keys)
    return Object.keys(project).every((key) => projectStringKeys.includes(key));
  }) || ['', null];

  // use the compatable promise instead so there are fewer database queries
  if (matchingPromise) {
    setProperty(doc, key, promises[matchingPromiseKey]);
    return;
  }

  // create a promise for the document
  promises[promiseKey] = Model.findById(_id, removePathCollision(project))
    .then(async (doc) => {
      if (doc) {
        // convert the document to a plain object
        const _doc = doc.toObject() as CollectionDoc;

        // inject promises to resolve for all nested children
        await Promise.all(
          children.map(async (child) => {
            return resolveReferencedDocument(promises, tenantDB, _doc, child);
          })
        );

        // return the doc with the promises
        return _doc;
      }
      return null;
    })
    .catch((err) => {
      throw err;
    });

  // set the value to the promise for the document
  setProperty(doc, key, promises[promiseKey]);
  return;
}

/**
 * MongoDB projections cannot have path collisions.
 * For example, `'a.b'` and `'a.b.c'` cannot both be used.
 *
 * This function removes path collisions by using the least specific path.
 * For example, for input `{ 'a.b': 1, 'a.b.c': 1 }`, only `{ 'a.b': 1 }` is returned.
 */
function removePathCollision(projection: Record<string, 1>): Record<string, 1> {
  const keys = Object.keys(projection);
  const res: Record<string, 1> = {};

  keys.forEach((key) => {
    try {
      const current = getProperty(res, key);
      if (current !== 1) setProperty(res, key, 1);
    } catch {
      //
    }
  });

  return flattenObject(res as { [key: string]: never });
}

export { resolveReferencedDocuments };
