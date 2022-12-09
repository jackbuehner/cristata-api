import { GenSchemaInput, NestedSchemaDefType } from 'genSchema';

const collection: GenSchemaInput = {
  name: 'Photo',
  canPublish: false,
  withPermissions: false,
  publicRules: false,
  schemaDef: {
    name: {
      type: 'String',
      required: true,
      modifiable: true,
      textSearch: true,
      field: {
        label: 'Photo name',
        order: 1,
        description: 'The name of the photo in Cristata. Be descriptive.',
      },
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
        order: 5,
        label: 'Note',
        description: 'Track details/notes about this photo. Text in this field is searchable.',
      },
      column: { hidden: true, label: 'Note' },
    },
    tags: {
      type: ['String'],
      required: false,
      modifiable: true,
      textSearch: true,
      default: [],
      field: {
        order: 3,
        label: 'Tags',
        description: 'Keywords related to the photo. Allows easier searching for photos.',
      },
      column: { order: 2, label: 'Tags', chips: true, width: 200 },
    },
    require_auth: {
      type: 'Boolean',
      required: false,
      modifiable: true,
      textSearch: false,
      default: false,
      field: {
        order: 4,
        label: 'Require authentication with Cristata to view or download this photo via the direct URL',
      },
      column: { order: 3, label: 'Require login', chips: true, width: 150 },
    },
    width: {
      type: 'Number',
      field: { hidden: true },
      column: { hidden: true },
      modifiable: false,
      required: true,
    },
    height: {
      type: 'Number',
      field: { hidden: true },
      column: { hidden: true },
      modifiable: false,
      required: true,
    },
    people: {
      photo_created_by: {
        type: 'String',
        textSearch: true,
        field: {
          label: 'Source',
          order: 2,
          description:
            'The photographer or artist of the photo. Be sure to credit the photographer/artist appropriately and correctly. Only use photos you have the rights to use.',
        },
        modifiable: true,
      },
    } as NestedSchemaDefType,
    json: {
      type: 'JSON',
      field: { hidden: true },
      column: { hidden: true },
      modifiable: true,
      required: false,
      default: '{}',
    },
    legacy_caption: {
      type: 'String',
      modifiable: false,
      field: {
        hidden: true,
      },
    },
    legacy_thumbnail_id: {
      type: 'String',
      modifiable: false,
      field: {
        hidden: true,
      },
    },
  },
};

export default collection;
