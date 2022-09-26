import { SchemaDefType } from './genSchema';

// schema fields to include in every collection
const standard: SchemaDefType = {
  timestamps: {
    created_at: { type: 'Date', required: true, default: new Date().toISOString() },
    modified_at: { type: 'Date', required: true, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: ['User', 'ObjectId'] },
    modified_by: { type: ['[User]', ['ObjectId']] },
    last_modified_by: { type: ['User', 'ObjectId'] },
    watching: { type: ['[User]', ['ObjectId']] },
  },
  hidden: { type: 'Boolean', required: true, default: false },
  locked: { type: 'Boolean', required: true, default: false },
  archived: { type: 'Boolean', required: true, default: false },
  __yState: { type: 'String' },
  __versions: [
    {
      snapshot: { type: 'String', required: true },
      timestamp: { type: 'Date', required: true },
      users: { type: ['JSON'], strict: false },
    },
  ],
  history: [
    {
      type: { type: 'String', required: true },
      user: { type: ['User', 'ObjectId'], required: true },
      at: {
        type: 'Date',
        required: true,
        default: new Date().toISOString(),
      },
    },
  ],
};

const publishable: SchemaDefType = {
  timestamps: {
    published_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
    updated_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    published_by: { type: ['[User]', ['ObjectId']] },
    last_published_by: { type: ['User', 'ObjectId'] },
  },
};

const withPermissions: SchemaDefType = {
  permissions: {
    teams: { type: ['String'] },
    users: { type: ['[User]', ['ObjectId']] },
  },
};

const defaultSchemaDefTypes = { standard, publishable, withPermissions };

export { defaultSchemaDefTypes };
