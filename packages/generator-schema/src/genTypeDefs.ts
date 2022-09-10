import { hasKey } from '@cristata/utils';
import { Type } from 'typescript';
import { GenSchemaInput, SchemaDef } from './genSchema';
import { calcAccessor } from './calcAccessor';
import { calcGraphFieldType } from './calcGraphFieldType';
import { genInputs } from './genInputs';
import { genMutations } from './genMutations';
import { genPrunedTypes } from './genPrunedTypes';
import { genQueries } from './genQueries';
import { genTypes } from './genTypes';
import { getInputInheritance } from './getInputInheritance';
import { getTypeInheritance } from './getTypeInheritance';
import { parseSchemaComponents } from './parseSchemaComponents';

/**
 * Generate the type definitions for the GraphQL schema.
 */
function genTypeDefs(input: GenSchemaInput): string {
  const { schemaDefs } = parseSchemaComponents(input.schemaDef);
  const onlyOneModifiable = JSON.stringify(input.schemaDef).match(/"modifiable":true/g)?.length === 1;
  const hasPublic = JSON.stringify(input.schemaDef).includes(`"public":true`);
  const hasSlug = hasKey('slug', input.schemaDef) && (input.schemaDef.slug as SchemaDef).type === 'String';

  const accessor = (() => {
    const [oneAccessorName, oneAccessorType] = calcAccessor('one', input.by);
    const [manyAccessorName, manyAccessorType] = calcAccessor('many', input.by);
    return {
      one: { name: oneAccessorName, typeName: oneAccessorType },
      many: { name: manyAccessorName, typeName: manyAccessorType },
    };
  })();

  return `
    ${genTypes({
      schema: input.schemaDef,
      typeName: input.name,
      typeInheritance: getTypeInheritance(input.canPublish, input.withPermissions),
      customQueries: input.customQueries,
    })}
    ${
      hasPublic
        ? genPrunedTypes({
            schema: {
              _id: { type: 'ObjectId', required: true, public: true },
              // ensure that the timestamps nested schema always exists
              ...(input.schemaDef.timestamps ? input.schemaDef : { timestamps: {}, ...input.schemaDef }),
            },
            typeName: input.name,
            isPublishable: input.canPublish,
          })
        : ``
    }
    ${genInputs({
      schema: input.schemaDef,
      typeName: input.name,
      typeInheritance: getInputInheritance(input.canPublish, input.withPermissions),
    })}
    ${genQueries({
      accessor: accessor,
      isPublishable: input.canPublish,
      customQueries: input.customQueries,
      options: input.options,
      schema: input.schemaDef,
      typeName: input.name,
      usePublicQueries: hasPublic && input.publicRules !== false ? (hasSlug ? 'withSlug' : true) : false,
    })}
    ${genMutations({
      accessor: accessor,
      isPublishable: input.canPublish,
      customMutations: input.customMutations,
      options: input.options,
      schema: input.schemaDef,
      typeName: input.name,
      modifyMutationInputTypeName: (() => {
        if (onlyOneModifiable) {
          const modifiableDef = schemaDefs.find(([, def]) => def.modifiable)?.[1];
          if (modifiableDef) {
            return calcGraphFieldType(modifiableDef, { useMongooseType: true });
          }
        }
        return undefined;
      })(),
    })}
  `;
}

export { genTypeDefs, calcAccessor, Type };
