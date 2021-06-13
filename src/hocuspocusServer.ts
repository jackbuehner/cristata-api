import { Server as Hocuspocus } from '@hocuspocus/server';
import { RocksDB } from '@hocuspocus/extension-rocksdb';

const hocuspocusServer = Hocuspocus.configure({
  port: 1234,
  extensions: [new RocksDB({ path: './database' })],
});

hocuspocusServer
  .listen()
  .then(() => console.log(`Cristata Hocuspocus server listening on port 1234!`))
  .catch((err: Error) =>
    console.error(`Failed to start Cristata Hocuspocus server on port 1234! Message: ${JSON.stringify(err)}`)
  );
