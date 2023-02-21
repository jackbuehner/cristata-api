import { GenSchemaInput } from 'genSchema';

const collection: GenSchemaInput = {
  name: 'Activity',
  canPublish: false,
  withPermissions: false,
  publicRules: { filter: {} },
  schemaDef: {
    name: { type: 'String', required: false },
    type: { type: 'String', required: true },
    colName: { type: 'String', required: true },
    docId: { type: 'ObjectId', required: true },
    userId: { type: 'ObjectId', required: true },
    at: { type: 'Date', required: true },
    diff: { type: 'JSON', modifiable: true, required: false },
    added: { type: 'JSON', modifiable: true, required: false },
    removed: { type: 'JSON', modifiable: true, required: false },
    updated: { type: 'JSON', modifiable: true, required: false },
  },
  options: {
    disableFindOneQuery: false,
    disableFindManyQuery: false,
    disableActionAccessQuery: true,
    disablePublicFindOneQuery: true,
    disablePublicFindOneBySlugQuery: true,
    disablePublicFindManyQuery: true,
    disableCreateMutation: true,
    disableModifyMutation: true,
    disableHideMutation: true,
    disableArchiveMutation: true,
    disableLockMutation: true,
    disableWatchMutation: true,
    disableDeleteMutation: true,
    disablePublishMutation: true,
  },
};

export default collection;
