/* eslint-disable no-var */
import mongoosePkg from 'mongoose';
import Cristata from '../Cristata';

declare global {
  var conn: mongoosePkg.Connection | null;
}

declare global {
  namespace Express {
    export interface Request {
      cristata: Cristata;
    }
  }
}

export {};
