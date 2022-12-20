import {
  deconstructSchema,
  defaultSchemaDefTypes,
  isTypeTuple,
  MongooseSchemaType,
  SchemaDefType,
} from '@jackbuehner/cristata-generator-schema';
import getFieldNames from 'graphql-list-fields';
import { merge } from 'merge-anything';
import { GenResolversInput } from './genResolvers';

type Info = Parameters<typeof getFieldNames>[0];

/**
 * Creates a projection that only fetches the document fields
 * requested in the GraphQL query.
 *
 * We do not worry about values required in fields' setters
 * since this is only run on the API server.
 * All changes on this server also go to the hocuspocus server,
 * which will handle the setters.
 */
function createProjection(
  info: Info,
  config: {
    schemaDef: GenResolversInput['schemaDef'];
    canPublish: GenResolversInput['canPublish'];
    withPermissions: GenResolversInput['withPermissions'];
  },
  options?: {
    keepReferenceFields?: boolean;
  }
) {
  // ensure we include the common schema defs
  const fullSchema = merge<SchemaDefType, SchemaDefType[]>(
    config.schemaDef || {},
    defaultSchemaDefTypes.standard,
    config.canPublish ? defaultSchemaDefTypes.publishable : {},
    config.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
  );

  const deconstructedSchema = deconstructSchema(fullSchema);

  // get the names of the requested fields
  let fields = getFieldNames(info).map((field) => field.replace('docs.', ''));

  if (options?.keepReferenceFields !== true) {
    // determine the names of the fields that are references/objectids
    const objectIdFields = deconstructedSchema
      .map(([key, def]): [string, MongooseSchemaType | 'DocArray', boolean] => {
        const [schemaType, isArray] = (() => {
          const schemaType: MongooseSchemaType | 'DocArray' = isTypeTuple(def.type) ? def.type[1] : def.type;
          const isArrayType = Array.isArray(schemaType);

          if (isArrayType) return [schemaType[0], true];
          return [schemaType, false];
        })();

        return [key, schemaType, isArray];
      })
      .filter(([, schemaType]) => {
        return schemaType === 'ObjectId';
      })
      .map(([key]) => key);

    // remove fields that are referenced values that the database does not see
    // (the database only has the _id, and graphql pulls them together)
    // and then add the root field with the _id
    objectIdFields.forEach((idField) => {
      if (fields.find((field) => field.indexOf(idField) === 0)) {
        fields = [...fields.filter((field) => field.indexOf(idField + '.') !== 0), idField];
      }
    });
  }

  const projection: Record<string, 1> = {};
  fields.forEach((field) => {
    projection[field] = 1;
  });

  return projection;
}

export { createProjection };
