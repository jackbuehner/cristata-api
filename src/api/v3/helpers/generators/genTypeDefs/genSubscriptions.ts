import { uncapitalize } from '../../../../../utils/uncapitalize';
import { GenSchemaInput } from '../genSchema';

interface GenSubscriptionParams {
  /**
   * The GraphQL type of the collection.
   */
  typeName: string;
  /**
   * The key name of the accessor and the associated GraphQL type.
   */
  accessor: Record<'one' | 'many', { name: string; typeName: string }>;
  options: GenSchemaInput['options'];
}

/**
 * Generates the subscription type definitions for the collection.
 */
function genSubscriptions(args: GenSubscriptionParams): string {
  return `extend type Subscription {
    ${
      args.options?.disableCreatedSubscription !== true
        ? `
            """
            Sends a ${args.typeName} document when it is created.
            """
            ${uncapitalize(args.typeName)}Created(): ${args.typeName}
          `
        : ``
    }
    ${
      args.options?.disableModifiedSubscription !== true
        ? `
            """
            Sends the updated ${args.typeName} document when it changes.
        
            If ${args.accessor.one.name} is omitted, the server will send changes for all shorturls.
            """
            ${uncapitalize(args.typeName)}Modified(${
            args.accessor.one.name
          }: ${args.accessor.one.typeName.replace('!', '')}): ${args.typeName}
          `
        : ``
    }
    ${
      args.options?.disableDeletedSubscription !== true
        ? `
            """
            Sends a ${args.typeName} ${args.accessor.one.name} when it is deleted.
        
            If ${args.accessor.one.name} is omitted, the server will send ${
            args.accessor.one.name
          }s for all deleted ${args.typeName}
            documents.
            """
            ${uncapitalize(args.typeName)}Deleted(${
            args.accessor.one.name
          }: ${args.accessor.one.typeName.replace('!', '')}): ${args.accessor.one.typeName}
          `
        : ``
    }
  }`;
}

export { genSubscriptions };
