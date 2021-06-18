// set up websocket server for sending data to the app
import WebSocket from 'ws';
const wss = new WebSocket.Server({
  noServer: true,
});

// keep track of the github payload events that the client requests
class Clients {
  constructor() {
    this.clientEvents = {};
    this.saveClient = this.saveClient.bind(this);
  }
  clientEvents: { [key: string]: string[] };
  saveClient(id: string, events: string[]) {
    this.clientEvents[id] = events;
  }
}
const clients = new Clients();

/**
 * Returns whether the input is valid JSON.
 */
function isValidJSON(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

interface WebSocketExtended extends WebSocket {
  id?: string;
  isAlive?: boolean;
}

wss.on('error', (err) => {
  console.error(err);
});

wss.on('connection', function connection(ws: WebSocketExtended) {
  // handle any errors
  ws.on('error', (err) => {
    console.error(err);
  });

  // set `isAlive` to true
  ws.isAlive = true;

  // handle incoming messages
  ws.on('message', function incoming(message) {
    // require messages to be valid JSON
    if (isValidJSON(message)) {
      const parsedMessage = JSON.parse(message as string);

      // if the message is sending client information, save that info for later
      if (parsedMessage.type === 'client_info') {
        const data = parsedMessage as { type: 'client_info'; id: string; events: string[] };
        clients.saveClient(data.id, data.events);
        // save the ID to the websocket instance for later use
        ws.id = data.id;
      }
    } else {
      ws.emit('error', 'Message must be valid JSON');
      ws.send('Error: Message must be valid JSON');
    }
  });

  ws.send('Connected to websocket server');

  wss.on('github_payload_received', (data: string) => {
    const parsedData: { event: string; [key: string]: unknown } = JSON.parse(data);
    // only send the data is the client requested the event
    if (ws.id && clients.clientEvents[ws.id].includes(parsedData.event)) {
      ws.send(data);
    }
  });

  ws.on('pong', () => {
    // set `isAlive` on every pong so that we know that the ws is still connected
    ws.isAlive = true;
  });
});

// frequently ping the websocket clients to keep them connected
const wsPingCheck = setInterval(() => {
  wss.clients.forEach((ws: WebSocketExtended) => {
    // if websocket is not alive but still active on the server, terminate it
    // (might have occurred if server did not detect that client disconnected)
    if (ws.isAlive === false) return ws.terminate();

    // check if websocket is alive
    ws.isAlive = false; // set to false (the 'pong' event will set it to true)
    ws.ping(); // ping the client
  });
}, 45000); // check every 45 seconds

// clean up any functions that depend on the websocket server
wss.on('close', () => {
  clearInterval(wsPingCheck);
});

export { wss };
