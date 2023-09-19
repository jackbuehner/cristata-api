/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  deconstructSchema,
  defaultSchemaDefTypes,
  SchemaDefType,
} from '@jackbuehner/cristata-generator-schema';
import { convertNullPrototype, insertUserToArray, isDefinedDate, slugify } from '@jackbuehner/cristata-utils';
import { addToY } from '@jackbuehner/cristata-ydoc-utils';
import { ApolloError, ForbiddenError, UserInputError } from 'apollo-server-errors';
import { detailedDiff, diff } from 'deep-object-diff';
import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { canDo, CollectionDoc, createDoc, findDoc, requireAuthentication } from '.';
import {
  CollectionSchemaFields,
  PrivateCollectionDocFields,
  PublishableCollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
} from '../../mongodb/helpers/constructBasicSchemaFields';
import { TenantDB } from '../../mongodb/TenantDB';
import { Context } from '../server';
import { setYDocType } from './setYDocType';

interface ModifyDoc<DocType, DataType> {
  model: string;
  data: CollectionDoc;
  by?: string;
  _id: mongoose.Types.ObjectId | string | number | Date;
  context: Context;
  publishable?: boolean;
  fullAccess?: boolean;
  modify?: (currentDoc: DocType, data: DataType) => Promise<void>;
}

async function modifyDoc<DocType, DataType>({
  model,
  data,
  context,
  publishable,
  fullAccess,
  modify,
  _id,
  by,
}: ModifyDoc<DocType, DataType>): Promise<HydratedCollectionDoc<DocType> | null> {
  requireAuthentication(context);

  const tenantDB = new TenantDB(context.tenant, context.config.collections);
  await tenantDB.connect();

  const Model = await tenantDB.model<DocType>(model);
  if (!Model) throw new ApolloError('model not found');

  // the config exists if the model was found
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const collectionConfig = context.config.collections.find((col) => col.name === model)!;

  // set defaults
  if (publishable === undefined) publishable = false;
  if (fullAccess === undefined) fullAccess = false;

  // if the current document does not exist OR the user does not have access, throw an error
  const currentDoc = (await findDoc({ model, _id, by, context, fullAccess })) as CurrentDocType;
  if (!currentDoc)
    throw new ApolloError(
      'the document you are trying to modify does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );

  // do not allow changing the stage to published
  if (currentDoc.stage !== 5.2 && data.stage === 5.2) {
    throw new UserInputError('you must use the publish mutation to set the stage to 5.2');
  }

  // require the stage to change from 5.2 if the doc is currently published
  // and this collection stored published docs in a separate copy
  // (aka directly editing published docs does not occur)
  if (
    collectionConfig.generationOptions?.independentPublishedDocCopy &&
    currentDoc.stage === 5.2 &&
    data.stage === 5.2
  ) {
    throw new UserInputError(
      'you must change the stage from 5.2 to make an unpublished change to this published doc'
    );
  }

  // merge the current doc and new data
  data = merge(currentDoc, convertNullPrototype(data));

  // if the user does not have permission to modify, throw an error
  if (!fullAccess && !(await canDo({ action: 'modify', model, context, doc: currentDoc })))
    throw new ForbiddenError('you cannot modify this document');

  // if the document is currently published and there is no independent
  // published doc copy, do not modify unless user can publish
  if (publishable && !collectionConfig.generationOptions?.independentPublishedDocCopy) {
    const isPublished = isDefinedDate(currentDoc.timestamps.published_at);

    if (isPublished && !fullAccess && !(await canDo({ action: 'publish', model, context, doc: currentDoc })))
      throw new ForbiddenError('you cannot modify published documents in this collection');

    if (isPublished) {
      // set updated published document metadata
      if (context.profile) {
        data = merge(data, {
          people: {
            published_by: insertUserToArray(currentDoc.people.published_by, context.profile._id),
            last_published_by: context.profile._id,
          },
        });
      }
      data = merge(data, {
        timestamps: {
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  // set modification metadata
  if (context.profile) {
    data = merge(data, {
      people: {
        modified_by: insertUserToArray(currentDoc.people.modified_by, context.profile._id), // adds the user to the array, and then removes duplicates
        last_modified_by: context.profile._id,
      },
      timestamps: {
        modified_at: new Date().toISOString(),
      },
    });
  }

  // save history
  if (context.profile && model !== 'ExternalAccount') {
    const type = 'patched';

    // TODO: remove this in a future version
    data = merge(data, {
      history: [
        ...(currentDoc.history || []),
        { type, user: context.profile._id, at: new Date().toISOString() },
      ],
    });

    const { added, deleted, updated } = detailedDiff(currentDoc, data);

    createDoc({
      model: 'Activity',
      context,
      args: {
        name: currentDoc.name,
        type,
        colName: model,
        docId: currentDoc._id,
        userIds: [context.profile._id],
        at: new Date(),
        added,
        deleted,
        updated,
      },
    });
  }

  // set the slug if the document is becoming published and it does not already have one
  // (only if the document has a slug property and a name property)
  if (publishable && !data.slug && (data.name || currentDoc.name)) {
    const willBePublished = !!data.timestamps.published_at && !currentDoc.timestamps.published_at;

    if (willBePublished && !data.slug) data.slug = slugify(`${data.name || currentDoc.name}`);
  }

  // execute the modify function
  await modify?.(currentDoc as DocType, data as unknown as DataType);

  // attempt to patch the article
  const res = await Model.findOneAndUpdate(
    // @ts-expect-error It's difficult to tell mongoose to use an accessor that might not exist, but it handles it fine
    { [by || '_id']: _id },
    { $set: data },
    { returnOriginal: false }
  );

  // sync the changes to the yjs doc
  const result = setYDocType(context, model, `${_id}`, async (TenantModel, ydoc) => {
    const collection = context.config.collections?.find((col) => col.name === model);

    const schema = merge<SchemaDefType, SchemaDefType[]>(
      collection?.schemaDef || {},
      defaultSchemaDefTypes.standard,
      collection?.canPublish ? defaultSchemaDefTypes.publishable : {},
      collection?.withPermissions ? defaultSchemaDefTypes.withPermissions : {}
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const changed = diff(currentDoc, data) as CollectionDoc;
    const { history, ...inputData } = changed;
    Object.keys(inputData).forEach((key) => {
      if (key.indexOf('__') === 0) {
        delete inputData[key];
      }
    });

    addToY({ inputData, schemaDef: deconstructSchema(schema), TenantModel, ydoc, onlyProvided: true });

    return true;
  });

  if (result instanceof Error) {
    result.message += ', but data may be set until the next time the collaborative document loads';
    throw result;
  }

  return res.value;
}

type HydratedCollectionDoc<DocType> = mongoose.Document<unknown, unknown, DocType> & DocType;

type CurrentDocType = CollectionSchemaFields &
  PrivateCollectionDocFields &
  PublishableCollectionSchemaFields &
  WithPermissionsCollectionSchemaFields &
  Record<string, unknown> & { _id: mongoose.Types.ObjectId };

export { modifyDoc };
