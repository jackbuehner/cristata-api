import { GenSchemaInput } from 'genSchema';

const collection: GenSchemaInput = {
  name: 'File',
  canPublish: false,
  withPermissions: false,
  publicRules: { filter: {} },
  schemaDef: {
    name: {
      type: 'String',
      required: true,
      modifiable: true,
      textSearch: true,
      field: {
        order: 1,
        label: 'Name',
        description:
          'The display name of this file. Changing this name does not affect the location/URL of the file – it only affects how you see it in Cristata.',
      },
      column: { order: 1, label: 'Name', width: 300, sortable: true },
    },
    file_type: {
      type: 'String',
      required: true,
      modifiable: false,
      field: { hidden: true },
      column: { hidden: true },
    },
    size_bytes: {
      type: 'Number',
      required: true,
      modifiable: false,
      field: { hidden: true },
      column: { hidden: true },
    },
    uuid: {
      type: 'String',
      required: true,
      modifiable: false,
      textSearch: true,
      field: { hidden: true },
      column: { hidden: true },
    },
    note: {
      type: 'String',
      required: false,
      modifiable: true,
      textSearch: true,
      field: {
        order: 4,
        label: 'Note',
        description: 'Track details/notes about this file. Text in this field is searchable.',
      },
      column: { hidden: true, label: 'Note' },
    },
    tags: {
      type: ['String'],
      required: false,
      modifiable: true,
      textSearch: true,
      default: [],
      field: { order: 2, label: 'Tags' },
      column: { order: 2, label: 'Tags', chips: true, width: 200 },
    },
    require_auth: {
      type: 'Boolean',
      required: false,
      modifiable: true,
      textSearch: false,
      default: false,
      field: {
        order: 3,
        label: 'Require authentication with Cristata to view or download this file via the direct URL',
      },
      column: { order: 3, label: 'Require login', chips: true, width: 150 },
    },
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
