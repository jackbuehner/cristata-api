import { replaceCircular } from '@jackbuehner/cristata-utils';
import { GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';

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
          const { config, db, cristata, restartApollo, ...prunedContext } = requestContext.context;
          cristata.logtail.error(
            JSON.stringify(
              replaceCircular({
                APOLLO_ERROR: {
                  prunedRequest,
                  prunedContext: {
                    ...prunedContext,
                    profile: prunedContext.profile
                      ? {
                          _id: prunedContext.profile._id,
                          name: prunedContext.profile.name,
                        }
                      : undefined,
                  },
                  errors: requestContext.errors,
                },
              })
            )
          );
        },
      };
    },
  };
}

export { LogErrorsToLogtail };
