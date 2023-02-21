/* eslint-disable @typescript-eslint/no-explicit-any */
import activityCollection from '@jackbuehner/cristata-generator-schema/dist/default-schemas/Activity';
import mongoose from 'mongoose';
import { genCollection } from '../graphql/helpers';
import { Collection } from '../types/config';

const activities = (tenant: string): Collection => {
  const collection = genCollection(
    {
      ...activityCollection,
      actionAccess: {
        get: { teams: ['admin'], users: [] },
        create: { teams: ['admin'], users: [] },
        modify: { teams: ['admin'], users: [] },
        hide: { teams: ['admin'], users: [] },
        lock: { teams: [], users: [] },
        watch: { teams: [], users: [] },
        archive: { teams: [], users: [] },
        delete: { teams: ['admin'], users: [] },
        publish: { teams: ['admin'], users: [] },
        bypassDocPermissions: { teams: ['admin'], users: [] },
      },
    },
    tenant
  );

  return collection;
};

interface IActivity {
  name?: string;
  type: string;
  colName: string;
  docId: mongoose.Types.ObjectId;
  userIds: mongoose.Types.ObjectId[];
  at: Date;
  diff?: any;
  added?: any;
  deleted?: any;
  updated?: any;
}

export { activities };
export type { IActivity };
