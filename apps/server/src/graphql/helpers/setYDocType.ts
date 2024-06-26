import { shared } from '@jackbuehner/cristata-ydoc-utils';
import mongoose from 'mongoose';
import ws from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';

type TenantModel = <T>(name: string) => Promise<mongoose.Model<T> | null>;

/**
 *
 */
async function setYDocType(
  context: Context,
  model: string,
  id: string,
  cb: (TenantModel: TenantModel, ydoc: Y.Doc, sharedHelper: typeof shared) => Promise<true | Error>,
  /**
   * reject and destroy after this time
   * (default 1 minute)
   */
  maxTime = 1000 * 60
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

      // reject if not resolved or rejected by the maximum time allowed
      const timeout = setTimeout(() => {
        reject(new Error('maximum time allotted for setting a ydoc shared type has elapsed'));
        wsProvider.disconnect();
        wsProvider.destroy();
      }, maxTime);

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
        const res = await cb((tenantDB.model as TenantModel).bind(tenantDB), ydoc, shared);
        if (res === true) resolve(true);
        else reject(res);

        clearTimeout(timeout);
        wsProvider.disconnect();
        wsProvider.destroy();
      });
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
