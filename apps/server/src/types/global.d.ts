/* eslint-disable no-var */
import mongoosePkg from 'mongoose';
import Cristata from '../Cristata';

declare global {
  var mongoose: Record<
    string,
    { conn: mongoosePkg.Connection | null; promise: Promise<typeof mongoosePkg> | null }
  >;
}

declare global {
  namespace Express {
    export interface Request {
      cristata: Cristata;
    }
  }
}

export {};
