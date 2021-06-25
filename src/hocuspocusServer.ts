import { Server as Hocuspocus } from '@hocuspocus/server';
import { RocksDB } from '@hocuspocus/extension-rocksdb';
import { wss } from './websocket';
import url from 'url';
import { app } from './server';

// configure the server
const hocuspocus = Hocuspocus.configure({
  port: parseInt(process.env.PORT),
  extensions: [new RocksDB({ path: './database' })],

  // use hocuspocus at '/hocupocus' and use wss at '/websocket'
  onUpgrade: async ({ request, socket, head }) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname.indexOf('/hocuspocus/') === 0) {
      // allow hocuspocus websocket to continue if the path starts with '/hocuspocus/
    } else if (pathname === '/websocket') {
      // use the wss websocket if the path is '/websocket
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      // otherwise, end the websocket connection request
      socket.end();
    }
  },

  onRequest: async ({ request, response }) => {
    // when a request is made to the server, load the app
    app(request, response);
  },
});

// start the http server and hocuspocus websocket server
hocuspocus
  .listen()
  .then(() =>
    console.log(
      `Cristata server listening on port ${process.env.PORT}! API, authentication, webhooks, and hocuspocus are running.`
    )
  )
  .catch((err: Error) =>
    console.error(
      `Failed to start Cristata  server on port ${process.env.PORT}! Message: ${JSON.stringify(err)}`
    )
  );

// make the http server available as its own variable
const { httpServer } = hocuspocus;

export { httpServer as server };
