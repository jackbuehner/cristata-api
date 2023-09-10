import { GenSchemaInput, SchemaDefType } from 'genSchema';

// TODO: exclude from hocuspocus
// TODO: exclude for listeners
// TODO: exclude from webhooks
// TODO: disallow merging anything except user permissions

const collection: GenSchemaInput = {
  name: 'ExternalAccount',
  canPublish: false,
  withPermissions: false,
  publicRules: false,
  schemaDef: {
    name: { type: 'String', required: true, modifiable: true },
    website: { type: 'String', required: true, modifiable: true },
    username: { type: 'String', required: true, modifiable: true },
    password: { type: 'EncryptedString', required: true, modifiable: true },
    mfa: [
      {
        // see https://github.com/google/google-authenticator/wiki/Key-Uri-Format
        type: { type: 'String', required: true, modifiable: false },
        user: { type: 'String', required: true, modifiable: false },
        secret: { type: 'EncryptedString', required: true, modifiable: false },
        issuer: { type: 'String', required: true, modifiable: false },
        algorithm: { type: 'String', required: true, modifiable: false },
        digits: { type: 'String', required: true, modifiable: false },
        counter: { type: 'String', required: true, modifiable: false },
        period: { type: 'String', required: true, modifiable: false },
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

interface ExternalAccountDoc {
  name: string;
  username: string;
  password: string;
  filters: {
    type: string;
    user: string;
    secret: string;
    issuer: string;
    algorithm: string;
    digits: string;
    counter: string;
    period: string;
  };
}

export default collection;
export type { ExternalAccountDoc };
