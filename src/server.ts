import { config } from './config';
import Cristata from './Cristata';

// start the server
const server = new Cristata(config);
server.start();
