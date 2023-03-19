/* eslint-disable @typescript-eslint/ban-types */
import mongoose from 'mongoose';
import { GenSchemaInput, SchemaDefType } from '../genSchema';

const collection: GenSchemaInput = {
  name: 'CristataWebhook',
  canPublish: false,
  withPermissions: false,
  publicRules: false,
  schemaDef: {
    name: { type: 'String', required: true },
    verb: { type: 'String', required: true },
    url: { type: 'String', required: true },
    triggers: { type: ['String'], required: true, default: [] },
    collections: { type: ['String'], required: true, default: [] },
    filters: [
      {
        key: { type: 'String', required: true, default: '_id' },
        conditon: { type: 'String', required: true, default: 'equals' },
        value: { type: 'String', required: true, default: '' },
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
  triggers: ('modify' | 'delete' | 'publish' | 'unpublish' | (string & {}))[];
  collections: [];
  filters: Array<{
    key: string;
    condition: 'equals' | 'not equals' | (string & {});
    value: string;
  }>;
}

export default collection;
export type { WebhookDoc };
