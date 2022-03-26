import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type { CollectionSchemaFields } from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const settings = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'Setting',
    canPublish: false,
    withPermissions: false,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: 'String', required: true, modifiable: false, unique: true },
      setting: { type: 'JSON', required: true, modifiable: true, strict: false },
    },
    Users,
    Teams,
    helpers,
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
