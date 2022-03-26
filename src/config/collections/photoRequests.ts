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
      name: { type: 'String', required: true, modifiable: true },
      stage: { type: 'Float', modifiable: true, default: Stage.NEW },
      article_id: { type: 'ObjectId', modifiable: true },
      people: {
        requested_by: { type: ['User', 'ObjectId'], modifiable: true },
      },
      permissions: {
        teams: { type: ['String'], modifiable: true, default: ['000000000000000000000003'] },
      },
    },
    Users,
    Teams,
    helpers,
    actionAccess: {
      get: { teams: [0], users: [] },
      create: { teams: [0], users: [] },
      modify: { teams: [0], users: [] },
      hide: { teams: [0], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      publish: { teams: ['admin'], users: [] },
      delete: { teams: ['admin'], users: [] },
    },
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
