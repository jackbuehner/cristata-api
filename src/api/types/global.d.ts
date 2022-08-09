/* eslint-disable no-var */
import mongoosePkg from 'mongoose';

declare global {
  var mongoose: Record<
    string,
    { conn: mongoosePkg.Connection | null; promise: Promise<typeof mongoosePkg> | null }
  >;
}

export {};
