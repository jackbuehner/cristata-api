import { Type } from './Type';
import { GraphSchemaType, isTypeTuple, SchemaDef } from './genSchema';

/**
 * Calculate the type for a given field.
 */
function calcGraphFieldType(
  def: SchemaDef,
  opts?: { allOptional?: boolean; optionalInitial?: boolean; useMongooseType?: boolean }
) {
  let type: GraphSchemaType;

  // if `def.type` is a tuple, the first value will be the one needed by graphql
  if (isTypeTuple(def.type)) {
    if (opts?.useMongooseType) type = Type.constructType(def.type[1]);
    else type = def.type[0];
  } else type = Type.constructType(def.type);

  // specify whether the field is required in the schema
  if (def.required && !opts?.allOptional) {
    // if the field as a default value and `optionalInitial` is true in the
    // function options, make the the field optional even though it is
    // marked as required.
    if (opts?.optionalInitial && def.default !== undefined) return `${type}`;

    // otherwise, make the field required.
    return `${type}!`;
  }

  // make field optional by default
  return `${type}`;
}

export { calcGraphFieldType };
