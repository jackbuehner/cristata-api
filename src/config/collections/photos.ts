import mongoose from 'mongoose';
import { genCollection } from '../../api/v3/helpers';
import type { CollectionSchemaFields, WithPermissionsCollectionSchemaFields } from '../../mongodb/db';
import type { Collection } from '../database';

const photos = (): Collection => {
  const collection = genCollection({
    name: 'Photo',
    canPublish: false,
    withPermissions: true,
    withSubscription: true,
    publicRules: false,
    schemaDef: {
      name: { type: 'String', required: true, modifiable: true, default: 'Untitled photo' },
      tags: { type: ['String'], modifiable: true, default: [] },
      file_type: { type: 'String', modifiable: true, default: undefined },
      photo_url: { type: 'String', modifiable: true, default: '' },
      dimensions: {
        x: { type: 'Number', modifiable: true },
        y: { type: 'Number', modifiable: true },
      },
      legacy_caption: { type: 'String' },
      legacy_thumbnail_id: { type: 'String' },
      size: { type: 'Number', modifiable: true },
      people: {
        photo_created_by: { type: 'String', modifiable: true },
        uploaded_by: { type: ['[User]', ['ObjectId']], modifiable: true },
      },
      permissions: {
        teams: { type: ['String'], modifiable: true, default: [0] },
      },
    },
    actionAccess: {
      get: { teams: [0], users: [new mongoose.Types.ObjectId('000000000000000000000000')] },
      create: { teams: [0], users: [] },
      modify: { teams: [0], users: [] },
      hide: { teams: [0], users: [] },
      lock: { teams: ['admin'], users: [] },
      watch: { teams: [0], users: [] },
      delete: { teams: ['admin'], users: [] },
    },
  });

  return collection;
};

interface IPhoto extends CollectionSchemaFields, CollectionSchemaFields, WithPermissionsCollectionSchemaFields {
  name: string;
  people: IPhotoPeople & CollectionSchemaFields['people'];
  tags?: string[];
  file_type?: string;
  photo_url: string;
  dimensions?: {
    x?: number;
    y?: number;
  };
  versions?: IPhoto[]; // store previous versions of the photo profile (only via v2 api)
  legacy_caption?: string;
  legacy_thumbnail_id?: string;
}

interface IPhotoPeople {
  photo_created_by?: string;
  uploaded_by?: mongoose.Types.ObjectId;
}

interface IPhotoDoc extends IPhoto, mongoose.Document {}

export type { IPhoto, IPhotoDoc };
export { photos };
