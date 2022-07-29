import ws from 'ws';

interface CloseWebsocketServerStopOptions {
  wss: ws.Server;
}

/**
 * Close a websocket subscription server when the apollo server stops.
 */
function CloseWebsocketServerStop({ wss }: CloseWebsocketServerStopOptions) {
  return {
    async serverWillStart() {
      return {
        async drainServer() {
          wss.close();
        },
      };
    },
  };
}

export { CloseWebsocketServerStop };
