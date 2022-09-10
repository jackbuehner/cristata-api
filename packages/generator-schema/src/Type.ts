import mongoose from 'mongoose';
import { MongooseSchemaType } from './genSchema';

/**
 * A set of functions for constructing the graphql type
 * based on the mongoose type.
 */
const Type = {
  constructType: (type: MongooseSchemaType): string => {
    const isArray = Type.isArray(type);
    //@ts-expect-error it's fine
    if (isArray) type = type[0];

    if (Type.isBoolean(type)) {
      if (isArray) return '[Boolean]';
      else return 'Boolean';
    }

    if (Type.isDate(type)) {
      if (isArray) return '[Date]';
      else return 'Date';
    }

    if (Type.isInt(type)) {
      if (isArray) return '[Int]';
      else return 'Int';
    }

    if (Type.isFloat(type)) {
      if (isArray) return '[Float]';
      else return 'Float';
    }

    if (Type.isObjectId(type)) {
      if (isArray) return '[ObjectID]';
      else return 'ObjectID';
    }

    if (Type.isString(type)) {
      if (isArray) return '[String]';
      else return 'String';
    }

    if (Type.isObject(type)) {
      if (isArray) return '[JSON]';
      else return 'JSON';
    }

    return 'Void';
  },
  isArray: (type: unknown): type is [unknown] => {
    if (typeof type === 'string') return type.includes('[') && type.includes(']');
    return Array.isArray(type) && type.length === 1;
  },
  isBoolean: (toCheck: unknown): boolean => {
    return toCheck === Boolean || toCheck === mongoose.Schema.Types.Boolean || toCheck === 'Boolean';
  },
  isDate: (toCheck: unknown): boolean => {
    return toCheck === Date || toCheck === mongoose.Schema.Types.Date || toCheck === 'Date';
  },
  isInt: (toCheck: unknown): boolean => {
    return toCheck === Number || toCheck === mongoose.Schema.Types.Number || toCheck === 'Number';
  },
  isFloat: (toCheck: unknown): boolean => {
    return toCheck === 'Float';
  },
  isObjectId: (toCheck: unknown): boolean => {
    return toCheck === mongoose.Types.ObjectId || toCheck === 'ObjectId' || toCheck === 'ObjectId';
  },
  isString: (toCheck: unknown): boolean => {
    return toCheck === String || toCheck === mongoose.Schema.Types.String || toCheck === 'String';
  },
  isObject: (toCheck: unknown): boolean => {
    return toCheck === JSON || toCheck === 'JSON';
  },
};

export { Type };
