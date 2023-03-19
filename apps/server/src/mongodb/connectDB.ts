import mongoose from 'mongoose';

async function connectDb(database = `app`, uri: string | null = null) {
  // check if the connection or promise has been stored in
  // node's global variable
  let cached = global.mongoose?.[database];

  // create a placeholder object if it does not exist
  if (!cached) {
    global.mongoose = { ...(global.mongoose || {}), [database]: { conn: null, promise: null } };
    cached = global.mongoose[database];
  }

  // return the connection if it already exists
  if (cached.conn) {
    return cached.conn;
  }

  // create a promised connection if no connection or promise exists
  if (!cached.promise) {
    const username = process.env.MONGO_DB_USERNAME;
    const password = process.env.MONGO_DB_PASSWORD;
    const host = process.env.MONGO_DB_HOST;
    const options = `retryWrites=true&w=majority`;

    // connect to mongoDB if not connected
    if (!mongoose.connection?.db?.admin?.()?.ping?.()) {
      if (uri) {
        cached.promise = mongoose.connect(uri);
      } else if (username && password && host) {
        cached.promise = mongoose.connect(`mongodb+srv://${username}:${password}@${host}/app?${options}`);
      } else {
        cached.promise = mongoose.connect(`mongodb://127.0.0.1/${database}?${options}`);
      }
    } else {
      cached.promise = (async () => mongoose)();
    }
  }

  // create a new connection, using a cached connection if it exists
  // (cached connections ensure that models are preserved)
  cached.conn = (await (await cached.promise).connection.asPromise()).useDb(database, { useCache: true });

  return cached.conn;
}

export { connectDb };
