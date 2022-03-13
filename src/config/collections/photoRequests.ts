import mongoose from 'mongoose';
import type { Helpers } from '../../api/v3/helpers';
import type { CollectionSchemaFields, WithPermissionsCollectionSchemaFields } from '../../mongodb/db';
import type { TeamsType, UsersType } from '../../types/config';
import type { Collection } from '../database';

const photoRequests = (helpers: Helpers, Users: UsersType, Teams: TeamsType): Collection => {
  const collection = helpers.generators.genCollection({
    name: 'PhotoRequest',
    canPublish: false,
    withPermissions: true,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: String, required: true, modifiable: true },
      stage: { type: 'Float', modifiable: true, default: Stage.NEW },
      article_id: { type: mongoose.Schema.Types.ObjectId, modifiable: true },
      people: {
        requested_by: { type: ['User', mongoose.Schema.Types.ObjectId], modifiable: true },
      },
      permissions: {
        teams: { type: [String], modifiable: true, default: [Teams.MANAGING_EDITOR] },
      },
    },
    Users,
    Teams,
    helpers,
    actionAccess: () => ({
      get: { teams: [Teams.ANY], users: [] },
      create: { teams: [Teams.ANY], users: [] },
      modify: { teams: [Teams.ANY], users: [] },
      hide: { teams: [Teams.ANY], users: [] },
      lock: { teams: [Teams.ADMIN], users: [] },
      watch: { teams: [Teams.ANY], users: [] },
      publish: { teams: [Teams.ADMIN], users: [] },
      delete: { teams: [Teams.ADMIN], users: [] },
    }),
  });

  return collection;
};

enum Stage {
  NEW = 1.1,
  IN_PROGRESS = 2.1,
  FULFILLED = 3.1,
}

interface IPhotoRequest
  extends CollectionSchemaFields,
    CollectionSchemaFields,
    WithPermissionsCollectionSchemaFields {
  name: string;
  people: IPhotoRequestPeople & CollectionSchemaFields['people'];
  stage: Stage;
  article_id?: string;
  versions?: IPhotoRequest[]; // store previous versions of the photoRequest profile (only via v2 api)
}

interface IPhotoRequestPeople {
  requested_by?: mongoose.Types.ObjectId;
}

interface IPhotoRequestDoc extends IPhotoRequest, mongoose.Document {}

export type { IPhotoRequest, IPhotoRequestDoc };
export { photoRequests, Stage as EnumPhotoRequestStage };
