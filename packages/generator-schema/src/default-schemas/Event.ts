import mongoose from 'mongoose';
import { GenSchemaInput } from '../genSchema';
import { WebhookDoc } from './Webhook';

const collection: GenSchemaInput = {
  name: 'CristataEvent',
  canPublish: false,
  withPermissions: false,
  publicRules: false,
  schemaDef: {
    name: { type: 'String', required: true },
    reason: { type: 'String', required: true },
    at: { type: 'Date', required: true },
    document: { type: 'JSON', required: false },
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

interface EventDoc {
  _id: mongoose.Types.ObjectId;
  /**
   * The name of the event. (e.g. webhook, publish, modify, etc.)
   */
  name: string;
  /**
   * The timestamp of when the event occured.
   */
  at: Date;
  /**
   * If a change stream event, this matches the change stream operation type.
   *
   * If a webhook event, this matches the webhook `_id`.
   */
  reason: string;
  /**
   * When an event is due to a document change, the details are populated in this object.
   */
  document?: {
    _id: mongoose.Types.ObjectId;
    collection: string;
    doc?: Record<string, unknown>;
    added?: object;
    deleted?: object;
    updated?: object;
  };
  webhook?: {
    _id: mongoose.Types.ObjectId;
    name: WebhookDoc['name'];
    verb: WebhookDoc['verb'];
    url: WebhookDoc['url'];
    trigger: string;
    collection: string;
    result: string;
  };
}

interface ChangeStreamEventDoc
  extends Pick<EventDoc, '_id'>,
    Pick<EventDoc, 'name'>,
    Pick<EventDoc, 'at'>,
    Pick<EventDoc, 'reason'>,
    Required<Pick<EventDoc, 'document'>> {}

interface WebhookEventDoc
  extends Pick<EventDoc, '_id'>,
    Pick<EventDoc, 'name'>,
    Pick<EventDoc, 'at'>,
    Pick<EventDoc, 'reason'>,
    Required<Pick<EventDoc, 'webhook'>> {}

export default collection;
export type { EventDoc, ChangeStreamEventDoc, WebhookEventDoc };
