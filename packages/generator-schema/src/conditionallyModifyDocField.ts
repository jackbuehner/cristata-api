import { hasKey, isArray, slugify } from '@cristata/utils';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import { get as getProperty, set as setProperty } from 'object-path';
import { GenSchemaInput, SchemaDef, SetterValueType } from './genSchema';

// comparison operators
type gt = { $gt: number };
type gte = { $gte: number };
type lt = { $lt: number };
type lte = { $lte: number };
type eq = { $eq: number | string };
type ne = { $ne: number | string };
type ComparisonOperator = gt | gte | lt | lte | eq | ne;

function isComparisonOperator(operator: AnyOperator): operator is ComparisonOperator {
  const comparisonOperatorKeys = ['$gt', '$gte', '$lt', '$lte', '$eq', '$ne'];
  return comparisonOperatorKeys.includes(Object.keys(operator)[0]);
}

function allAreComparisonOperators(operators: AnyOperator[]): operators is ComparisonOperator[] {
  return operators.every((operator) => isComparisonOperator(operator));
}

// element operators
type exists = { $exists: boolean };
type ElementOperator = exists;

function isElementOperator(operator: AnyOperator): operator is ElementOperator {
  const elementOperatorKeys = ['$exists'];
  return elementOperatorKeys.includes(Object.keys(operator)[0]);
}

// logical operators
type and<T> = { $and: Array<T> };
type or<T> = { $or: Array<T> };
type LogicalOperator<T = ComparisonOperator> = and<T> | or<T>;

function isLogicalOperator(operator: AnyOperator): operator is LogicalOperator {
  const logicalOperatorKeys = ['$and', '$or'];
  return logicalOperatorKeys.includes(Object.keys(operator)[0]);
}

/**
 * @TJS-additionalProperties true
 */
type Field = Record<string, AnyOperator>;

// combined operator types
type AnyOperator = ComparisonOperator | LogicalOperator | ElementOperator;

type SetterCondition = LogicalOperator<Field>;

/**
 * TODO: document this function
 */
function conditionallyModifyDocField(
  doc: mongoose.Document | null,
  data: mongoose.LeanDocument<mongoose.Document>,
  gc: GenSchemaInput
): void {
  // TODO: include nested schema defs
  const flatSchemaKeys = Object.keys(gc.schemaDef);

  // for each key, attempt to find a setter
  // and apply it (if applicable)
  flatSchemaKeys.forEach((arg) => {
    // find the setter in the schema definition (undefined if no setter)
    const setter: SchemaDef['setter'] = getProperty(gc.schemaDef, arg + '.setter');

    if (setter) {
      // whether the setter's condition is met
      const shouldModify = process(data, setter.condition);
      if (shouldModify) setProperty(data, arg, calcSetterValue(setter.value, data));
    }
  });
}

function process(doc: mongoose.LeanDocument<mongoose.Document>, condition: SetterCondition): boolean {
  // array of booleans where each boolean represents
  // whether an operator returned true or false
  const responses: boolean[] = Object.entries(condition).map(([logiOpName, nestedOpsWithField]) => {
    // get whether each field passed its condition
    const responses: boolean[] = nestedOpsWithField.map((opsWithField) => {
      return processField(opsWithField, doc);
    });

    // if $and, every field must pass
    if (logiOpName === '$and') return responses.every((result) => result === true);
    // if $or, only one field needs to pass
    if (logiOpName === '$or') return responses.some((result) => result === true);

    // use false for any other operator name
    return false;
  });

  // return true if the field operators only produced true responses
  return !responses.includes(false);
}

function processField(field: Field, doc: mongoose.LeanDocument<mongoose.Document>): boolean {
  // array of booleans where each boolean represents
  // whether an operator returned true or false
  const responses: boolean[] = Object.entries(field).map(([fieldName, operator]) => {
    // we map through the object entries because an object with multiple
    // entries is the same putting multiple objects with only one
    // entry into the $and operator, e.g.:
    // `{ $and: [ { $gt: 4 }, { $lt: 8 } ] }` is the same as
    // `{ $gt: 4, $lt: 8 }`
    return processOperator(operator, fieldName, doc);
  });

  // return true if the field operators only produced true responses
  return !responses.includes(false);
}

/**
 * Returns whether the operator's condition is true.
 */
function processOperator(
  operator: AnyOperator,
  fieldName: string,
  doc: mongoose.LeanDocument<mongoose.Document>
): boolean {
  // operators can include multiple operators as different
  // key-value pairs, so we need to look at each object entry
  const operatorEntries = Object.entries(operator);

  // array of booleans where each boolean represents whether the condition was
  // true or false
  const responses: boolean[] = operatorEntries.map(([opName, opVal]) => {
    const docPropVal = getProperty(doc, fieldName);

    if (isComparisonOperator({ [opName]: opVal } as AnyOperator)) {
      if (opName === '$gt') return parseFloat(docPropVal) > parseFloat(opVal);
      if (opName === '$gte') return parseFloat(docPropVal) >= parseFloat(opVal);
      if (opName === '$lt') return parseFloat(docPropVal) < parseFloat(opVal);
      if (opName === '$lte') return parseFloat(docPropVal) <= parseFloat(opVal);
      if (opName === '$eq') return docPropVal == opVal;
      if (opName === '$ne') return docPropVal != opVal;
    }

    if (isElementOperator({ [opName]: opVal } as AnyOperator)) {
      if (opName === '$exists') {
        if (opVal === true) return docPropVal !== undefined || docPropVal !== null;
        if (opVal === false) return docPropVal === undefined || docPropVal === null;
      }
    }

    if (isLogicalOperator({ [opName]: opVal } as AnyOperator)) {
      // for logical operators, put each subset operator through this
      // function again and construct a single boolean
      // from the array of booleans
      if (opName === '$and' && allAreComparisonOperators(opVal)) {
        // true if every condition returned true
        return opVal
          .map((operator) => processOperator(operator, fieldName, doc))
          .every((result) => result === true);
      }
      if (opName === '$or' && allAreComparisonOperators(opVal)) {
        // true if at least once condition returned true
        return opVal
          .map((operator) => processOperator(operator, fieldName, doc))
          .some((result) => result === true);
      }
    }

    // if no condition was matched, return false
    return false;
  });

  // return true if the operator only produced true responses
  return !responses.includes(false);
}

/**
 * Calculate the default value for a new document.
 */
function calcSetterValue(val: SetterValueType, data: Record<string, unknown>): unknown {
  // if a string, use the string
  if (typeof val === 'string') return val;
  // if a number, use the number
  else if (typeof val === 'number') return val;
  // if a boolean, use the boolean
  else if (typeof val === 'boolean') return val;
  // if an array, use process the values of the array
  else if (isArray(val)) return val.map((v: SetterValueType) => calcSetterValue(v, data)).filter((v) => !!v);
  // if a specification for a code, generate the code
  else if (hasKey('code', val) && hasKey('length', val)) {
    const { code: codeType, length: codeLength } = val;

    // alphanumeric code
    if (codeType === 'alphanumeric') {
      const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', codeLength);
      return generateCode();
    }
  }
  // if a specification for slugifying, generate the code
  else if (hasKey('slugify', val)) {
    const { slugify: keyToSlugify, separator } = val;
    return slugify(getProperty(data, keyToSlugify), separator);
  }

  // return undefined if no condition is met
  return undefined;
}

export type { SetterCondition };
export { conditionallyModifyDocField };
