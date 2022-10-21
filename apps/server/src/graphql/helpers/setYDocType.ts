import { shared } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import ws from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

/**
 *
 */
async function setYDocType(
  context: Context,
  model: string,
  id: string,
  cb: (
    TenantModel: (name: string) => Promise<mongoose.Model<unknown> | null>,
    ydoc: Y.Doc,
    sharedHelper: typeof shared
  ) => Promise<true | Error>
): Promise<true | Error> {
  // return without connecting if we are testing
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  return await new Promise<true | Error>((resolve, reject) => {
    try {
      // create an empty ydoc to use with the websocket provider
      const ydoc = new Y.Doc();
      const docName = `${context.tenant}.${model}.${id}`;

      // create a websocket provider
      const wsProvider = new WebsocketProvider(process.env.HOCUSPOCUS_SERVER || '', docName, ydoc, {
        // @ts-expect-error it's fine
        WebSocketPolyfill: ws,
        params: {
          authSecret: process.env.AUTH_OVERRIDE_SECRET || '',
        },
      });

      // fail after unable to connect 10 times
      let disconnectedCount = 0;
      wsProvider.on('status', ({ status }: { status: 'disconnected' | 'connecting' | 'connected' }) => {
        if (status === 'disconnected') {
          if (disconnectedCount < 10) {
            disconnectedCount++;
            console.log('disconnected', disconnectedCount);

            // wait 1 second before attempting to reconnect
            wsProvider.shouldConnect = false;
            setTimeout(() => {
              wsProvider.connect();
            }, 1000);
          } else {
            // after ten attempts, reject with an error and destroy the websocket
            reject(new Error(`Connection failed after 10 attempts for ${docName}`));
            wsProvider.destroy();
          }
        }
      });

      // run the callback once a sync event has happened
      wsProvider.once('sync', async () => {
        // connect to the database
        const tenantDB = new TenantDB(context.tenant, context.config.collections);
        await tenantDB.connect();

        // execute the callback
        const res = await cb(tenantDB.model.bind(tenantDB), ydoc, shared);
        if (res === true) resolve(true);
        else reject(res);

        wsProvider.destroy();
      });
      return true;
    } catch (error) {
      if (error instanceof Error) {
        reject(error);
        return error;
      }
      reject(new Error(`${error}`));
      return new Error(`${error}`);
    }
  });
}

export { setYDocType };
