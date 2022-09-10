/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { insertUserToArray } from '@cristata/utils';
import { ApolloError } from 'apollo-server-core';
import { ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, findDoc, requireAuthentication } from '.';
import { Context } from '../server';

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

  // set the publish properties
  if (args.publish) {
    doc.timestamps.published_at = args.published_at;
  }
  if (args.publish && context.profile) {
    doc.people.published_by = insertUserToArray(doc.people.published_by, context.profile._id);
    doc.people.last_published_by = context.profile._id;
  }

  // set relevant collection metadata
  if (context.profile) {
    doc.people.modified_by = insertUserToArray(doc.people.modified_by, context.profile._id);
    doc.people.last_modified_by = context.profile._id;
    doc.history = [
      ...(doc.history || []),
      {
        type: 'published',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save the document
  return await doc.save();
}

export { publishDoc };
