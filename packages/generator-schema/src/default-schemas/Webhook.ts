/* eslint-disable @typescript-eslint/ban-types */
import mongoose from 'mongoose';
import { GenSchemaInput, SchemaDefType } from '../genSchema';

const collection: GenSchemaInput = {
  name: 'CristataWebhook',
  canPublish: false,
  withPermissions: false,
  publicRules: false,
  schemaDef: {
    name: { type: 'String', required: true, modifiable: true },
    verb: { type: 'String', required: true, modifiable: true },
    url: { type: 'String', required: true, modifiable: true },
    triggers: { type: ['String'], required: true, default: [], modifiable: true },
    collections: { type: ['String'], required: true, default: [], modifiable: true },
    filters: [
      {
        key: { type: 'String', required: true, default: '_id', modifiable: true },
        condition: { type: 'String', required: true, default: 'equals', modifiable: true },
        value: { type: 'String', required: true, default: '', modifiable: true },
      },
    ] satisfies [SchemaDefType],
  },
  options: {
    disableFindOneQuery: false,
    disableFindManyQuery: false,
    disableActionAccessQuery: true,
    disablePublicFindOneQuery: true,
    disablePublicFindOneBySlugQuery: true,
    disablePublicFindManyQuery: true,
    disableCreateMutation: false,
    disableModifyMutation: false,
    disableHideMutation: true,
    disableArchiveMutation: true,
    disableLockMutation: true,
    disableWatchMutation: true,
    disableDeleteMutation: false,
    disablePublishMutation: true,
  },
};

interface WebhookDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  verb: 'GET' | 'POST' | (string & {});
  url: string;
  triggers: ('create' | 'modify' | 'delete' | 'publish' | 'unpublish' | (string & {}))[];
  collections: [];
  filters: Array<{
    key: string;
    condition: 'equals' | 'not equals' | (string & {});
    value: string;
  }>;
}

export default collection;
export type { WebhookDoc };
