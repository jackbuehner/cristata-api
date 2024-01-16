import mongoose from 'mongoose';

async function connectDb(database = `app`, uri: string | null = null) {
  if (!uri) {
    const username = process.env.MONGO_DB_USERNAME;
    const password = process.env.MONGO_DB_PASSWORD;
    const host = process.env.MONGO_DB_HOST;
    const useSrv = !host?.includes(':');
    const options = process.env.MONGO_DB_OPTIONS || `retryWrites=true`;

    if (username && password && host) {
      uri = `mongodb${useSrv ? '+srv' : ''}://${username}:${password}@${host}/app?${options}`;
    } else {
      uri = `mongodb://127.0.0.1/${database}?${options}`;
    }
  }

  if (!global.conn) {
    global.conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });

    // required to avoid multiple function calls creating new connections
    await global.conn.asPromise();

    // log errors and close then connection
    global.conn.once('error', (error) => {
      console.error('Mongoose connection error', error);
      global.conn?.close(true);
    });

    // when a connection is closed, delete all models and detroy the connection
    global.conn.once('close', () => {
      global.conn?.deleteModel(/.*/); // delete all models on `conn`
      global.conn?.destroy();
      global.conn = null;
    });
  }

  // return the connection with the correct database
  return global.conn.useDb(database, { useCache: true });
}

export { connectDb };
