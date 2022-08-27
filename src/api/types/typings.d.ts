/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'mongoose-aggregate-paginate-v2' {
  function aggregatePaginate(): void;
  export = aggregatePaginate;
}

declare module 'cors-anywhere' {
  import { Server } from 'https';

  function createServer(options: any): Server;

  module.exports = { createServer };
}

declare module 'graphql-s2s' {
  function getSchemaAST(graphQlSchema: any): string;
  function transpileSchema(graphQlSchema: any): string;
  function extractGraphMetadata(schema?: string): any[];
  function getGenericAlias(s: any): ((genName: string) => string) | ((genName: any) => any);
  function getQueryAST(
    query: [type],
    operationName: any,
    schemaAST: [type],
    options?: { defrag: boolean }
  ): [type];
  function buildQuery(operation?: any, skipOperationParsing?: boolean): string;
  function isTypeGeneric(type: any, genericLetter: any): any;

  const graphqls2s = {
    getSchemaAST,
    transpileSchema,
    extractGraphMetadata,
    getGenericAlias,
    getQueryAST,
    buildQuery,
    isTypeGeneric,
  };

  export { graphqls2s };
}
