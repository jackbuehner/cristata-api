/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isSchemaDef } from '@jackbuehner/cristata-generator-schema';
import { insertUserToArray } from '@jackbuehner/cristata-utils';
import { ApolloError } from 'apollo-server-core';
import { ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, CollectionDoc, findDoc, requireAuthentication } from '.';
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

  // the config exists if the model worked in `findDoc()`
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const collectionConfig = context.config.collections.find((col) => col.name === model)!;

  //if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'publish', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot publish this document');

  // sync the changes to the yjs doc
  const result = await setYDocType(context, model, `${_id}`, async (TM, ydoc, sharedHelper) => {
    const reference = new sharedHelper.Reference(ydoc);
    const date = new sharedHelper.Date(ydoc);
    const float = new sharedHelper.Float(ydoc);
    const boolean = new sharedHelper.Boolean(ydoc);

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
    const draftStageOption = stageFieldOptions.find(({ value }) => value === 2.1) || {
      value: 2.1,
      label: 'Draft',
    };

    if (args.publish) float.set('stage', [lastStage || 5.2], [publishedStageOption]);
    else float.set('stage', [2.1], [draftStageOption]);

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
    if (collectionConfig.generationOptions?.independentPublishedDocCopy) {
      boolean.set('_hasPublishedDoc', args.publish);
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

  if (result instanceof Error) throw result;

  // save history
  if (context.profile) {
    doc.history = [
      ...(doc.history || []),
      {
        type: args.publish ? 'published' : 'unpublished',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save copy of published doc
  if (collectionConfig.generationOptions?.independentPublishedDocCopy) {
    if (args.publish) {
      const leanDoc = doc.toObject();

      // get a lean copy of the doc with all private keys removed (keys starting with _ or __, excluding _id)
      const publishDocCopy = Object.keys(leanDoc)
        .filter((key) => {
          if (key === '_id') return true;
          return key.indexOf('_') !== 0;
        })
        .reduce((obj, key) => {
          return Object.assign(obj, {
            [key]: leanDoc[key],
          });
        }, {} as NonNullable<Required<CollectionDoc>['__publishedDoc']>);

      // save the published copy of the doc
      doc.__publishedDoc = publishDocCopy;
      doc.__publishedDoc.stage = 5.2;
      doc.__publishedDoc.timestamps.published_at = args.published_at;
      if (context.profile) {
        doc.__publishedDoc.people.modified_by = insertUserToArray(doc.people.modified_by, context.profile._id);
        doc.__publishedDoc.people.last_modified_by = context.profile._id;
      }
    } else {
      doc.__publishedDoc = null;
    }
  }

  const res = await doc.save();
  return res;
}

export { publishDoc };
