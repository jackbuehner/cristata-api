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
  ) => Promise<true | string>
): Promise<void> {
  // return without connecting if we are testing
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  return await new Promise<void>((resolve, reject) => {
    try {
      // create an empty ydoc to use with the websocket provider
      const ydoc = new Y.Doc();

      // create a websocket provider
      const wsProvider = new WebsocketProvider(
        process.env.HOCUSPOCUS_SERVER || '',
        `${context.tenant}.${model}.${id}`,
        ydoc,
        {
          // @ts-expect-error it's fine
          WebSocketPolyfill: ws,
          params: {
            authSecret: process.env.AUTH_OVERRIDE_SECRET || '',
          },
        }
      );

      // run the callback once a sync event has happened
      wsProvider.once('sync', async () => {
        // connect to the database
        const tenantDB = new TenantDB(context.tenant, context.config.collections);
        await tenantDB.connect();

        // execute the callback
        const res = await cb(tenantDB.model.bind(tenantDB), ydoc, shared);
        if (res === true) resolve();
        else reject(res);

        wsProvider.destroy();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export { setYDocType };
