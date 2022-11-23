import { GenSchemaInput } from 'genSchema';

const collection: GenSchemaInput = {
  name: 'File',
  canPublish: true,
  withPermissions: false,
  publicRules: { filter: {} },
  schemaDef: {
    name: { type: 'String', required: true, modifiable: true },
    stage: {
      type: 'Float',
      required: true,
      modifiable: true,
      field: {
        options: [
          { label: 'Unpublished', value: 1.1 },
          { label: 'Published', value: 5.2 },
        ],
      },
    },
    mime_type: { type: 'String', required: true, modifiable: false },
    size_bytes: { type: 'Number', required: true, modifiable: false },
    location: { type: 'String', required: true, modifiable: false },
    note: { type: 'String', required: false, modifiable: true },
    tags: { type: ['String'], required: false, modifiable: true },
  },
  options: {
    disablePublicFindOneBySlugQuery: true,
    disableHideMutation: true,
    disableArchiveMutation: true,
    disableLockMutation: true,
    disableWatchMutation: true,
    disableDeleteMutation: true,
  },
};

export default collection;
