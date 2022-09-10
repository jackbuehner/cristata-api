import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';

function GraphQLPlayground() {
  return ApolloServerPluginLandingPageGraphQLPlayground({
    settings: {
      'general.betaUpdates': false,
      'editor.theme': 'dark',
      'editor.cursorShape': 'line',
      'editor.reuseHeaders': true,
      'tracing.hideTracingResponse': true,
      'queryPlan.hideQueryPlanResponse': true,
      'editor.fontSize': 14,
      'editor.fontFamily': `'Dank Mono', 'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace`,
      'request.credentials': 'include',
    },
  });
}

export { GraphQLPlayground };
