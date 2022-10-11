/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { insertUserToArray, isDefinedDate } from '@jackbuehner/cristata-utils';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, findDoc, requireAuthentication } from '.';
import { Context } from '../server';
import { setYDocType } from './setYDocType';

interface ArchiveDoc {
  /**
   * The model name for the collection of the doc to be modified.
   */
  model: string;
  accessor: {
    /**
     * The key of the accessor.
     * @default '_id'
     */
    key?: string;
    /**
     * The value of the accessor to be targeted in the database
     * (usually a unique `ObjectId`).
     */
    value: mongoose.Types.ObjectId | string | number | Date;
  };
  /**
   * Whether the document with the matching accessor key and value
   * should be archived.
   * @default true
   */
  archive?: boolean;
  /**
   * An Apollo context object.
   */
  context: Context;
}

/**
 * This helper archives a specified document by adding `archived: true` to the document.
 * This action can be undone.
 *
 * This helper will not work if there are not archive permissions listen in the
 * collection's configuration object (archive is optional).
 */
async function archiveDoc({ model, accessor, archive, context }: ArchiveDoc) {
  requireAuthentication(context);

  // set defaults
  if (archive === undefined) archive = true;
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc)
    throw new ApolloError(
      'the document you are trying to archive does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the document is currently published, do not modify unless user can publish
  const canPublish = context.config.collections.find(({ name }) => name === model)?.canPublish;
  if (canPublish) {
    const isPublished = isDefinedDate(doc.timestamps.published_at);

    if (isPublished && !(await canDo({ action: 'publish', model, context, doc: doc as never })))
      throw new ForbiddenError('you cannot archive this document when it is published');
  }

  // if the user cannot hide documents in the collection, return an error
  if (!(await canDo({ action: 'archive', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot archive this document');

  // sync the changes to the yjs doc
  setYDocType(context, model, `${accessor.value}`, async (TM, ydoc, sharedHelper) => {
    const rc = { collection: 'User' };
    const toHex = (_id?: mongoose.Types.ObjectId) => _id?.toHexString();

    // set the archived property in the document
    const boolean = new sharedHelper.Boolean(ydoc);
    boolean.set('archived', archive);

    // set modification data
    if (context.profile) {
      const reference = new sharedHelper.Reference(ydoc);
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

  // set history
  if (context.profile) {
    doc.history = [
      ...(doc.history || []),
      {
        type: archive ? 'archive' : 'unarchive',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save the document
  return await doc.save();
}

export { archiveDoc };
