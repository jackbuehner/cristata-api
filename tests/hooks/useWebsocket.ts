import { terminateWsPingCheck } from '../../src/websocket';

/**
 * Terminates the websocket ping function after all tests complete.
 */
function useWebsocket(): Record<string, never> {
  afterAll(async () => {
    terminateWsPingCheck(); // avoid jest open handle error
  });

  return {};
}

export { useWebsocket };
