import mongoose, { SchemaDefinition } from 'mongoose';
import { TeamsType, UsersType } from '../../../../types/config';
import { genTypeDefs } from './genTypeDefs';
import { genSchemaFields } from './genSchemaFields';
import { hasKey } from '../../../../utils/hasKey';
import { SetterCondition } from './conditionallyModifyDocField';

function genSchema(input: GenSchemaInput): { typeDefs: string; schemaFields: SchemaDefinition } {
  const typeDefs = genTypeDefs(input);
  const schemaFields = genSchemaFields(input);

  return { typeDefs, schemaFields };
}

interface GenSchemaInput {
  /**
   * Whether documents in this collection can be marked as published.
   * This adds extra people and timestamp fields for track who published
   * a document and when it was published.
   */
  canPublish: boolean;
  /**
   * Whether this collection allows setting permissions for each document
   * in addition to global collection permissions.
   */
  withPermissions: boolean;
  /**
   * Whether a subscription should be provided for listening to
   * document creations, modifications, and deletions in this collection.
   */
  withSubscription: boolean;
  /**
   * The name of this collection.
   */
  name: string;
  /**
   * The definition for the schema. GraphQL type definitions and the mongoose schema are
   * generated from this.
   */
  schemaDef: SchemaDefType;
  /**
   * The accessor for retrieving one document or many documents.
   *
   * The default accessor is '_id' of with a `SchemaType` of 'ObjectId`.
   *
   * Provide a string accessor if it is the same for getting one document
   * or many documents. (e.g. `['code', 'Number']`).
   *
   * Provide an object with keys `one` and `many` to specify different
   * accessors for retrieving one document vs many documents.
   *
   * An 's' will always be appended to the name of the accessor when selecting
   * many documents. The type when selecting many documents will be an
   * array of the specified type.
   */
  by?: [string, SchemaType] | { one: [string, SchemaType]; many: [string, SchemaType] };
  /**
   * The baseline users that can be used in the config.
   */
  Users: UsersType;
  /**
   * The baseline teams that can be used in the config.
   */
  Teams: TeamsType;
  /**
   * Specify rules for public queries.
   *
   * Use `false` to disallow public queries.
   *
   * `filter`: MongoDB filter to sort out documents that need to remain private
   *           (use `{}` for no filter)
   *
   * `slugDateField`: the field to use to ensure that the publicBySlug query returns the
   *                  correct slug
   */
  publicRules:
    | false
    | {
        filter: mongoose.FilterQuery<unknown>;
        slugDateField?: string;
      };
  /**
   * Create custom queries based on MongoDB aggregation pipelines.
   */
  customQueries?: Array<{
    /**
     * camelCase name of the custom query.
     *
     * The query name will be capitalized and the name of the collection
     * will be prepended to the query name.
     *
     * For example, `'stageCounts'` becomes `'satireStageCounts'`.
     */
    name: string;
    /**
     * The description of the query. Be sure to use a helpful description
     * so someone else can know what this query does. Can be seen in
     * GraphQL introspection.
     */
    description: string;
    /**
     * A string list of arguments for the query.
     *
     * Example: `name: String!, slug: String`
     */
    accepts?: string;
    /**
     * An un-named object type that represents the returned values from the
     * pipeline.
     *
     * Example: `{ _id: Float!, count: Int! }`
     */
    returns: string;
    /**
     * A MongoDB aggregation pipeline.
     * [Pipeline stage reference](https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/#aggregation-pipeline-stages)
     */
    pipeline: mongoose.PipelineStage[];
  }>;
}

/**
 * Whether the type is a the tuple with the GraphQL type and the mongoose type
 */
function isTypeTuple(toCheck: unknown): toCheck is [GraphSchemaType, MongooseSchemaType] {
  return (
    toCheck !== null &&
    toCheck !== undefined &&
    typeof toCheck === 'object' &&
    Array.isArray(toCheck) &&
    toCheck.length === 2
  );
}

interface SchemaRef {
  /**
   * The collection from which the data for this field comes.
   */
  model: string;
  /**
   * The identifying field on the referenced collection.
   * It must match the `match` field from the current collection.
   */
  by: string;
  /**
   * The identifying field on the current collection.
   * It must match the `by` field from the referenced collection.
   */
  matches: string;
  /**
   * The field from the referenced collection document
   * that contains the value to be used for this field.
   */
  field: string;
  fieldType: SchemaType;
  public?: boolean;
}

/**
 * Checks that the input is a schema references instead
 * of an object containing schema definitions.
 */
function isSchemaRef(
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef
): toCheck is SchemaRef {
  return (
    hasKey('model', toCheck) &&
    typeof toCheck.model === 'string' &&
    hasKey('by', toCheck) &&
    typeof toCheck.by === 'string' &&
    hasKey('matches', toCheck) &&
    typeof toCheck.matches === 'string' &&
    hasKey('field', toCheck) &&
    typeof toCheck.field === 'string'
  );
}

interface SchemaDef {
  type: SchemaType;
  required?: boolean;
  unique?: boolean;
  // objects only; whether values not in the schema can be saved to the db
  strict?: boolean;
  /**
   * A default value to use for a new document.
   *
   * If a string is provided, the string value will be used for every new
   * document.
   *
   * If a code specification is provided, a new code will be generated
   * for each new document.
   */
  default?: SchemaDefaultValueType;
  modifiable?: boolean;
  public?: boolean;
  setter?: {
    condition: SetterCondition;
    value: SetterValueType;
  };
}

type SetterValueType =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | { slugify: string; separator?: string }
  | { code: 'alphanumeric'; length: number };

// allow nesting schema definitions inside objects
type SchemaDefType = { [key: string]: SchemaDef | NestedSchemaDefType | SchemaRef };
type NestedSchemaDefType = { [key: string]: SchemaDef | NestedSchemaDefType };

/**
 * Checks that the input is a schema definition instead
 * of an object containing schema definitions.
 */
function isSchemaDef(
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef
): toCheck is SchemaDef {
  return hasKey('type', toCheck);
}

/**
 * Checks that the input is a schema definition instead
 * of an object containing schema definitions.
 */
function isSchemaDefOrType(
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef
): toCheck is SchemaDefType | NestedSchemaDefType | SchemaDef {
  return !isSchemaRef(toCheck);
}

type SchemaDefaultValueType =
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | { code: 'alphanumeric'; length: number };

type SchemaType = MongooseSchemaType | [GraphSchemaType, MongooseSchemaType];

function isCustomGraphSchemaType(toCheck: string): boolean {
  const builtIn = [
    'String',
    'Int',
    'Float',
    'Boolean',
    'ObjectId',
    'Date',
    'JSON',
    '[String]',
    '[Int]',
    '[Float]',
    '[Boolean]',
    '[ObjectId]',
    '[Date]',
    '[JSON]',
  ];

  return !builtIn.includes(toCheck);
}

type GraphSchemaType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'ObjectId'
  | 'Date'
  | 'JSON'
  | '[String]'
  | '[Int]'
  | '[Float]'
  | '[Boolean]'
  | '[ObjectId]'
  | '[Date]'
  | '[JSON]'
  | string;

type MongooseSchemaType =
  | BooleanConstructor
  | [BooleanConstructor]
  | typeof mongoose.Schema.Types.Boolean
  | [typeof mongoose.Schema.Types.Boolean]
  | DateConstructor
  | [DateConstructor]
  | typeof mongoose.Schema.Types.Date
  | [typeof mongoose.Schema.Types.Date]
  | NumberConstructor
  | [NumberConstructor]
  | typeof mongoose.Schema.Types.Number
  | [typeof mongoose.Schema.Types.Number]
  | typeof mongoose.Schema.Types.Decimal128
  | [typeof mongoose.Schema.Types.Decimal128]
  | typeof mongoose.Schema.Types.ObjectId
  | [typeof mongoose.Schema.Types.ObjectId]
  | StringConstructor
  | [StringConstructor]
  | typeof mongoose.Schema.Types.String
  | [typeof mongoose.Schema.Types.String]
  | JSON
  | [JSON];

export type {
  GenSchemaInput,
  GraphSchemaType,
  MongooseSchemaType,
  NestedSchemaDefType,
  SchemaDef,
  SchemaDefType,
  SchemaRef,
  SchemaType,
  SchemaDefaultValueType,
  SetterValueType,
};
export { genSchema, isCustomGraphSchemaType, isTypeTuple, isSchemaDef, isSchemaRef, isSchemaDefOrType };
