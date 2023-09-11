import { GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';

/**
 * Log errors to console with:
 * - pruned request
 * - pruned context
 * - errors
 */
function LogErrorsToConsole() {
  return {
    // log errors
    async requestDidStart(): Promise<GraphQLRequestListener | void> {
      return {
        async didEncounterErrors(requestContext: GraphQLRequestContext) {
          const isSilentOperation = requestContext.operationName?.indexOf('__Silent_') === 0;
          if (isSilentOperation) return;

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { http, ...prunedRequest } = requestContext.request;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { config, db, cristata, restartApollo, ...prunedContext } = requestContext.context;
          console.error({
            message: 'Apollo::didEncounterError',
            level: 'error',
            prunedRequest,
            prunedContext: {
              ...prunedContext,
              profile: {
                _id: prunedContext.profile?._id,
                name: prunedContext.profile?.name,
              },
            },
            errors: requestContext.errors,
          });
        },
      };
    },
  };
}

export { LogErrorsToConsole };
