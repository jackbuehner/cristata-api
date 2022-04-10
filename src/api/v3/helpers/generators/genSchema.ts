import mongoose, { SchemaDefinition } from 'mongoose';
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
  options?: {
    disableFindOneQuery?: boolean;
    disableFindManyQuery?: boolean;
    disableActionAccessQuery?: boolean;
    disablePublicFindOneQuery?: boolean;
    disablePublicFindOneBySlugQuery?: boolean;
    disablePublicFindManyQuery?: boolean;
    disableCreateMutation?: boolean;
    disableModifyMutation?: boolean;
    disableHideMutation?: boolean;
    disableLockMutation?: boolean;
    disableWatchMutation?: boolean;
    disableDeleteMutation?: boolean;
    disablePublishMutation?: boolean;
    disableCreatedSubscription?: boolean;
    disableModifiedSubscription?: boolean;
    disableDeletedSubscription?: boolean;
    /**
     * Keys of fields that contain ObjectIDs of the users who
     * must always receive notification emails when documents
     * in this collection change via Cristata.
     *
     * The keys may reference fields that are arrays or single
     * values.
     */
    mandatoryWatchers?: string[];
    watcherNotices?: {
      subjectField: string;
      stageField: string;
      stageMap: Record<number, string>;
      fields: Array<{
        name: string;
        label: string;
        numMap?: Record<number, string>;
      }>;
    };
  };
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
     * Whether the query can be used without authentication.
     */
    public?: boolean;
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
     *
     * If you want to specify a type that already exists, provide it
     * without curly brackets.
     */
    returns: string;
    /**
     * A MongoDB aggregation pipeline.
     * [Pipeline stage reference](https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/#aggregation-pipeline-stages)
     */
    pipeline: mongoose.PipelineStage[];
    /**
     * Choose a specific path from the pipeline result to send to clients.
     * Powered by object-path.
     */
    path?: string;
  }>;
  /**
   * Create custom mutations.
   */
  customMutations?: Array<{
    /**
     * camelCase name of the custom mutation.
     *
     * The mutation name will be capitalized and the name of the collection
     * will be prepended to the query name.
     *
     * For example, `'stageCounts'` becomes `'satireStageCounts'`.
     */
    name: string;
    /**
     * The description of the mutation. Be sure to use a helpful description
     * so someone else can know what this mutation does. Can be seen in
     * GraphQL introspection.
     */
    description: string;
    /**
     * Whether the query can be used without authentication.
     */
    public?: boolean;
    /**
     * The action this query does.
     *
     * Supported actions:
     *
     * `$inc`: pass `{ inc: [fieldName, type] }`, where type matches the type of the field in the schema (NO !).
     */
    action: { inc: [string, string] };
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
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef | [SchemaDefType]
): toCheck is SchemaRef {
  return (
    typeof toCheck === 'object' &&
    !Array.isArray(toCheck) &&
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
  rule?: { match: RegExp; message: string };
  /**
   * Configure the way the field appears in the CMS.
   */
  field?: FieldDef;
}

interface FieldDef {
  /**
   * Field label.
   */
  label?: string;
  /**
   * Field description.
   */
  description?: string;
  /**
   * Whether the field is read only
   */
  readonly?: boolean;
  /**
   * The order in which this field appears (default: -1)
   */
  order?: number;
  /**
   * Configure this field as a select
   */
  options?: StringOption[] | NumberOption[];
  /**
   * Hide this field
   */
  hidden?: boolean;
  /**
   * Configure this field as a reference to another collection.
   */
  reference?: {
    /**
     * The singular version of the collection name.
     */
    collection?: string;
    /**
     * The fields
     */
    fields: { _id?: string; name?: string };
    /**
     * Require these fields for the found doc to be selectable.
     */
    require?: string[];
  };
  /**
   * Configure tiptap for the field.
   *
   * Only applies to the field with key 'body'.
   */
  tiptap?: TiptapOptions;
}

interface TiptapOptions {
  type: string;
  isHTMLkey?: string;
  layouts?: {
    key: string;
    options: { value: string; label: string }[];
  };
  keys_article?: {
    headline: string;
    description: string;
    categories: string;
    caption: string;
    photo_url: string;
    authors: string;
    target_publish_at: string;
  };
  features: {
    fontFamilies?: {
      name: string;
      label?: string;
      disabled?: boolean;
    }[];
    fontSizes?: string[];
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    bulletList?: boolean;
    orderedList?: boolean;
    textStylePicker?: boolean;
    horizontalRule?: boolean;
    widgets?: {
      photoWidget?: boolean;
      sweepwidget?: boolean;
      youtube?: boolean;
    };
    link?: boolean;
    comment?: boolean;
    trackChanges?: boolean;
  };
}

type StringOption = { label: string; value: string; disabled?: boolean };
type NumberOption = { label: string; value: number; disabled?: boolean };

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
type SchemaDefType = { [key: string]: SchemaDef | NestedSchemaDefType | SchemaRef | [SchemaDefType] };
type NestedSchemaDefType = { [key: string]: SchemaDef | NestedSchemaDefType };

/**
 * Checks that the input is a schema definition instead
 * of an object containing schema definitions.
 */
function isSchemaDef(
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef | [SchemaDefType]
): toCheck is SchemaDef {
  return typeof toCheck === 'object' && !Array.isArray(toCheck) && hasKey('type', toCheck);
}

/**
 * Checks that the input is a schema definition instead
 * of an object containing schema definitions.
 */
function isSchemaDefOrType(
  toCheck: SchemaDefType | NestedSchemaDefType | SchemaDef | SchemaRef | [SchemaDefType]
): toCheck is SchemaDefType | NestedSchemaDefType | SchemaDef {
  return typeof toCheck === 'object' && !Array.isArray(toCheck) && !isSchemaRef(toCheck);
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
  | 'Boolean'
  | ['Boolean']
  | 'Date'
  | ['Date']
  | 'Number'
  | ['Number']
  | 'Float'
  | ['Float']
  | 'ObjectId'
  | ['ObjectId']
  | 'String'
  | ['String']
  | 'JSON'
  | ['JSON'];

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
  StringOption,
  NumberOption,
  FieldDef,
  TiptapOptions,
};
export { genSchema, isCustomGraphSchemaType, isTypeTuple, isSchemaDef, isSchemaRef, isSchemaDefOrType };
