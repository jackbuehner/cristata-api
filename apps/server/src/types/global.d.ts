/* eslint-disable no-var */
import mongoosePkg from 'mongoose';
import Cristata from '../Cristata';

declare global {
  var conn: mongoosePkg.Connection | null;
  var defaultCollections: Record<string, Collection[]>;
}

declare global {
  namespace Express {
    export interface Request {
      cristata: Cristata;
    }
  }
}

export {};
