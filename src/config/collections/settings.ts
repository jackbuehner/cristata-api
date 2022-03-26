import mongoose from 'mongoose';
import { genCollection } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { Collection } from '../database';

const settings = (): Collection => {
  const collection = genCollection({
    name: 'Setting',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: 'String', required: true, modifiable: false, unique: true },
      setting: { type: 'JSON', required: true, modifiable: true, strict: false },
    },
    actionAccess: {
      get: { teams: ['admin'], users: [] },
      create: { teams: ['admin'], users: [] },
      modify: { teams: ['admin'], users: [] },
      hide: { teams: [], users: [] },
      lock: { teams: [], users: [] },
      watch: { teams: [], users: [] },
      delete: { teams: [], users: [] },
    },
    options: {
      disableHideMutation: true,
      disableLockMutation: true,
      disableWatchMutation: true,
      disableDeleteMutation: true,
      disablePublishMutation: true,
      disableDeletedSubscription: true,
    },
  });

  return collection;
};

interface ISettings extends CollectionSchemaFields {
  name: string;
  setting: Record<string, unknown> & mongoose.Document;
}

interface ISettingsDoc extends ISettings, mongoose.Document {}

export type { ISettings, ISettingsDoc };
export { settings };
