/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isSchemaDef } from '@jackbuehner/cristata-generator-schema';
import { insertUserToArray } from '@jackbuehner/cristata-utils';
import { ApolloError } from 'apollo-server-core';
import { ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, findDoc, requireAuthentication } from '.';
import { Context } from '../server';
import { setYDocType } from './setYDocType';

interface PublishDoc {
  model: string;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  args: {
    published_at?: string; // ISO date string
    publish?: boolean;
  };
  context: Context;
}

async function publishDoc({ model, args, by, _id, context }: PublishDoc) {
  requireAuthentication(context);

  // set defaults
  if (args.publish === undefined) args.publish = true;
  if (args.published_at === undefined) args.published_at = new Date().toISOString();

  // get the document
  const doc = await findDoc({ model, by, _id, context, lean: false });
  if (!doc) {
    throw new ApolloError(
      'the document you are trying to publish does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );
  }

  //if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'publish', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot publish this document');

  // sync the changes to the yjs doc
  await setYDocType(context, model, `${_id}`, async (TM, ydoc, sharedHelper) => {
    const reference = new sharedHelper.Reference(ydoc);
    const date = new sharedHelper.Date(ydoc);
    const float = new sharedHelper.Float(ydoc);

    const rc = { collection: 'User' };
    const toHex = (_id?: mongoose.Types.ObjectId) => _id?.toHexString();

    // get the published stage info
    const collection = context.config.collections.find((col) => col.name === model);
    const stageSchemaDef =
      collection && isSchemaDef(collection.schemaDef.stage) ? collection?.schemaDef.stage : undefined;
    const stageFieldOptions = stageSchemaDef?.field?.options as { value: string | number; label: string }[];
    const stageFieldOptionsAscendingOrder = stageFieldOptions?.sort((a, b) => {
      if (a.value.toString() > b.value.toString()) return -1;
      return 1;
    });
    const lastStage = parseFloat(stageFieldOptionsAscendingOrder?.[0]?.value?.toString() || '0') || undefined;
    const publishedStageOption = stageFieldOptions.find(({ value }) => value === lastStage) || {
      value: lastStage || 5.2,
      label: 'Published',
    };

    float.set('stage', [lastStage || 5.2], [publishedStageOption]);

    // set the publish properties
    if (args.publish) {
      date.set('timestamps.published_at', args.published_at);
    }
    if (args.publish && context.profile) {
      await reference.set(
        'people.published_by',
        insertUserToArray(doc.people.published_by, context.profile._id).map(toHex),
        TM,
        rc
      );
      await reference.set('people.last_published_by', [context.profile._id].map(toHex), TM, rc);
    }

    // set modifiication metadata
    if (context.profile) {
      await reference.set(
        'people.modified_by',
        insertUserToArray(doc.people.modified_by, context.profile._id).map(toHex),
        TM,
        rc
      );
      await reference.set('people.last_modified_by', [context.profile._id].map(toHex), TM, rc);
    }

    return true;
  });

  // save history
  if (context.profile) {
    doc.history = [
      ...(doc.history || []),
      {
        type: 'published',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }
  const res = await doc.save();

  return res;
}

export { publishDoc };
