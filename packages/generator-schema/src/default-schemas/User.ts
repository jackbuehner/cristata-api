import { GenSchemaInput } from 'genSchema';

const collection: GenSchemaInput = {
  name: 'User',
  canPublish: false,
  withPermissions: false,
  publicRules: { filter: {} },
  schemaDef: {
    name: { type: 'String', required: true, modifiable: true, public: true, default: 'New User' },
    slug: { type: 'String', required: true, modifiable: true, public: true, default: 'new-user' },
    phone: { type: 'Float', modifiable: true },
    email: { type: 'String', modifiable: true, public: true },
    twitter: { type: 'String', modifiable: true, public: true },
    biography: { type: 'String', modifiable: true, public: true },
    current_title: { type: 'String', modifiable: true, public: true },
    timestamps: {
      joined_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
      left_at: { type: 'Date', required: true, default: '0001-01-01T01:00:00.000+00:00' },
      last_login_at: { type: 'Date', required: true, default: new Date().toISOString() },
      last_active_at: { type: 'Date', required: true, default: new Date().toISOString() },
    },
    photo: { type: 'String', modifiable: true, public: true },
    last_magic_code: { type: 'String', modifiable: false },
    github_id: { type: 'Number', public: true },
    group: { type: 'Float', modifiable: true, public: true, default: '5.10' },
    methods: { type: ['String'], default: [] },
    retired: { type: 'Boolean', default: false },
    flags: { type: ['String'], required: true, default: [] },
    constantcontact: {
      access_token: { type: 'String' },
      refresh_token: { type: 'String' },
      expires_at: { type: 'Number' },
    },
  },
  options: {
    disableFindOneQuery: true,
  },
};

export default collection;
