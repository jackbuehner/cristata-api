import CristataServer from './Cristata';

const server = new CristataServer();
server.start();

// log the stack of warnings so we can figure out from where the warning is coming
process.on('warning', (error) => {
  console.warn(error);
  console.warn(error.stack);
});
