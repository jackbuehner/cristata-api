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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { http, ...prunedRequest } = requestContext.request;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { config, db, cristata, restartApollo, ...prunedContext } = requestContext.context;
          console.error('Apollo::didEncounterErrors::prunedRequest', prunedRequest);
          console.error('Apollo::didEncounterErrors::prunedContext', {
            ...prunedContext,
            profile: {
              _id: prunedContext.profile._id,
              name: prunedContext.profile.name,
            },
          });
          console.error('Apollo::didEncounterErrors::errors', requestContext.errors);
        },
      };
    },
  };
}

export { LogErrorsToConsole };
