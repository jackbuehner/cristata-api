/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '../../../apollo';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { slugify } from '../../../utils/slugify';
import mongoose from 'mongoose';
import { canDo, CollectionDoc, findDoc, requireAuthentication } from '.';
import {
  CollectionSchemaFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../../mongodb/db';
import { merge } from 'merge-anything';

interface ModifyDoc {
  model: string;
  data: CollectionDoc;
  context: Context;
  publishable?: boolean;
}

async function modifyDoc({ model, data, context, publishable }: ModifyDoc) {
  requireAuthentication(context);
  const Model = mongoose.model<typeof data>(model);

  // set defaults
  if (publishable === undefined) publishable = false;

  // remove _id from the data object and convert it to an object id
  const { _id: string_id } = data;
  const _id = new mongoose.Types.ObjectId(string_id as string);

  // if the current document does not exist OR the user does not have access, throw an error
  const currentDoc = (await findDoc({ model, _id, context })).toObject() as unknown as CollectionSchemaFields &
    PublishableCollectionSchemaFields &
    WithPermissionsCollectionSchemaFields &
    Record<string, unknown>;
  if (!currentDoc)
    throw new ApolloError(
      'the document you are trying to modify does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // if the document is currently published, do not modify unless user can publish
  if (publishable) {
    const isPublished = !!currentDoc.timestamps.published_at;

    if (isPublished && !canDo({ action: 'publish', model, context }))
      throw new ForbiddenError('you cannot modify published documents in this collection');
    else if (isPublished) {
      // set updated published document metadata
      data = merge(data, {
        people: {
          ...currentDoc.people,
          ...data.people,
          published_by: [...new Set([...currentDoc.people.published_by, context.profile._id])],
          last_published_by: context.profile._id,
        },
        timestamps: {
          ...currentDoc.timestamps,
          ...data.timestamps,
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  // set modification metadata
  data = merge(data, {
    people: {
      ...currentDoc.people,
      ...data.people,
      modified_by: [...new Set([...currentDoc.people.modified_by, context.profile._id])], // adds the user to the array, and then removes duplicates
      last_modified_by: context.profile._id,
    },
    timestamps: {
      ...currentDoc.timestamps,
      ...data.timestamps,
      modified_at: new Date().toISOString(),
    },
    history: currentDoc.history
      ? [...currentDoc.history, { type: 'patched', user: context.profile._id, at: new Date().toISOString() }]
      : [{ type: 'patched', user: context.profile._id, at: new Date().toISOString() }],
    permissions: {
      ...currentDoc.permissions,
      ...data.permissions,
    },
  });

  // set the slug if the document is becoming published and it does not already have one
  // (only if the document has a slug property and a name property)
  if (publishable && !data.slug && (data.name || currentDoc.name)) {
    const willBePublished = !!data.timestamps.published_at && !currentDoc.timestamps.published_at;

    if (willBePublished && !data.slug) data.slug = slugify(`${data.name || currentDoc.name}`);
  }

  // attempt to patch the article
  return await Model.findByIdAndUpdate(_id, { $set: data }, { returnOriginal: false });
}

export { modifyDoc };
