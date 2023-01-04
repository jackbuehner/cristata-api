/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { insertUserToArray, isDefinedDate, notEmpty } from '@jackbuehner/cristata-utils';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import mongoose from 'mongoose';
import { canDo, findDoc, requireAuthentication } from '.';
import { Context } from '../server';
import { setYDocType } from './setYDocType';
interface HideDoc {
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
   * should be hidden.
   * @default true
   */
  hide?: boolean;
  /**
   * An Apollo context object.
   */
  context: Context;
}

async function hideDoc({ model, accessor, hide, context }: HideDoc) {
  requireAuthentication(context);

  // set defaults
  if (hide === undefined) hide = true;
  if (accessor.key === undefined) accessor.key = '_id';

  // get the document
  const doc = await findDoc({ model, by: accessor.key, _id: accessor.value, context, lean: false });

  // throw error if user cannot view the doc
  if (!doc)
    throw new ApolloError(
      'the document you are trying to hide does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // the config exists if the model worked in `findDoc()`
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const collectionConfig = context.config.collections.find((col) => col.name === model)!;

  // if the document is currently published, do not modify unless user can publish
  const canPublish = context.config.collections.find(({ name }) => name === model)?.canPublish;
  if (canPublish) {
    const isPublished = isDefinedDate(doc.timestamps.published_at);

    if (isPublished && !(await canDo({ action: 'publish', model, context, doc: doc as never })))
      throw new ForbiddenError('you cannot hide this document when it is published');
  }

  // if the user cannot hide this document, return an error
  if (!(await canDo({ action: 'hide', model, context, doc: doc as never })))
    throw new ForbiddenError('you cannot hide this document');

  const toHex = (_id?: mongoose.Types.ObjectId) => _id?.toHexString();
  const peopleModifiedBy = context.profile
    ? insertUserToArray(doc.people.modified_by, context.profile._id)
    : doc.people.modified_by;

  // sync the changes to the yjs doc
  const result = setYDocType(context, model, `${accessor.value}`, async (TM, ydoc, sharedHelper) => {
    const rc = { collection: 'User' };

    // set the hidden property in the document
    const boolean = new sharedHelper.Boolean(ydoc);
    boolean.set('hidden', hide);

    // set modification data
    if (context.profile) {
      const reference = new sharedHelper.Reference(ydoc);
      await reference.set('people.modified_by', peopleModifiedBy.map(toHex).filter(notEmpty), TM, rc);
      await reference.set('people.last_modified_by', [context.profile._id].map(toHex), TM, rc);
    }

    return true;
  });

  if (result instanceof Error) throw result;

  if (process.env.NODE_ENV === 'test' && context.profile) {
    doc.hidden = hide;
    doc.people.modified_by = peopleModifiedBy;
    doc.people.last_modified_by = context.profile._id;
  }

  // set the history
  if (context.profile) {
    doc.history = [
      ...(doc.history || []),
      {
        type: hide ? 'hidden' : 'unhidden',
        user: context.profile._id,
        at: new Date().toISOString(),
      },
    ];
  }

  // save change in published doc
  if (collectionConfig.generationOptions?.independentPublishedDocCopy && doc.__publishedDoc) {
    doc.__publishedDoc.hidden = hide;
  }

  // save the document
  return await doc.save();
}

export { hideDoc };
