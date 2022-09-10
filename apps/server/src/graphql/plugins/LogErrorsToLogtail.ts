import { GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';
import Cristata from 'Cristata';

/**
 * Log errors to logtail with:
 * - pruned request
 * - pruned context
 * - errors
 */
function LogErrorsToLogtail() {
  return {
    // log errors
    async requestDidStart(): Promise<GraphQLRequestListener | void> {
      return {
        async didEncounterErrors(requestContext: GraphQLRequestContext) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { http, ...prunedRequest } = requestContext.request;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { config, db, restartApollo, ...prunedContext } = requestContext.context;
          const cristata = requestContext.context.cristata as Cristata;
          cristata.logtail.error(
            JSON.stringify({
              APOLLO_ERROR: {
                prunedRequest,
                prunedContext,
                errors: requestContext.errors,
              },
            })
          );
        },
      };
    },
  };
}

export { LogErrorsToLogtail };
