import { storePayload } from '@hocuspocus/server';
import { DeconstructedSchemaDefType, GenSchemaInput } from '@jackbuehner/cristata-generator-schema';
import { hasKey, isObjectId, notEmpty, sendEmail, writeWatcherEmailBody } from '@jackbuehner/cristata-utils';
import { isObject } from 'is-what';
import mongoose from 'mongoose';
import mongodb from 'mongoose/node_modules/mongodb';
import { get as getProperty } from 'object-path';
import { parseName } from '../utils';
import { CollectionDoc, DB } from './DB';

/**
 * Send stage update emails
 */
export async function sendStageUpdateEmails(
  documentName: storePayload['documentName'],
  docData: Record<string, unknown>,
  prevStage: number,
  collection: mongodb.Collection<CollectionDoc>,
  by: Awaited<ReturnType<DB['collectionAccessor']>>,
  collectionOptions: GenSchemaInput['options'],
  tenantDb: DB,
  deconstructedSchema: DeconstructedSchemaDefType
): Promise<void> {
  const { tenant, collectionName, itemId } = parseName(documentName);

  if (
    docData &&
    hasKey('stage', docData) &&
    typeof docData.stage === 'number' &&
    collectionOptions?.watcherNotices
  ) {
    const newStage = docData.stage;

    if (newStage !== prevStage) {
      const mandatoryWatchersKeys = collectionOptions?.mandatoryWatchers || [];

      // get watchers ids
      const watchersData = await collection.findOne(
        {
          [by.one[0]]:
            by.one[1] === 'ObjectId'
              ? new mongoose.Types.ObjectId(itemId)
              : by.one[1] === 'Date'
              ? new Date(itemId)
              : itemId,
        },
        {
          projection: {
            _id: 1,
            'people.watching': 1,
            ...Object.fromEntries(mandatoryWatchersKeys.map((key) => [key, 1])),
          },
        }
      );

      const usersCollection = tenantDb.collection(tenant, 'User');
      if (!usersCollection) {
        console.error('[INVALID USER COLLECTION] FAILED TO GET WATCHER USER EMAILS FOR TENANT', tenant);
        throw new Error(`User collection for watchers was not found in the database for ${tenant}`);
      }

      const emailInfo = await tenantDb.tenantEmailInfo(tenant);
      if (!emailInfo.secrets?.aws) {
        console.error('[MISSING EMAIL INFO] FAILED TO GET WATCHER EMAIL INFO FOR TENANT', tenant);
        throw new Error(`Tenant email info was not found in the database for ${tenant}`);
      }

      // get the emails of the watchers with duplicates removed
      const mandatoryWatchersEmails = await getWatcherEmails(docData, mandatoryWatchersKeys, usersCollection);
      const watchersEmails = (await getWatcherEmails(docData, ['people.watching'], usersCollection)).filter(
        (email) => !mandatoryWatchersEmails.includes(email)
      );

      // get the label for the stage from the column and field def (column def is preferred)
      const stageDef = deconstructedSchema.find(([key]) => key === 'stage')?.[1];
      const stageOptions = (
        isObject(stageDef?.column?.chips) ? stageDef?.column?.chips : stageDef?.field?.options
      ) as { value: string | number; label: string }[];
      const stageLabel =
        stageOptions?.find((opt) => opt.value.toString() === newStage.toString())?.label || newStage.toString();

      // create the email subject using the stage label and main subject field
      const subject = `[Stage: ${stageLabel}] ${getProperty(
        docData,
        collectionOptions.watcherNotices.subjectField
      )}`;

      const bodySettings = {
        model: collectionName,
        identifier: itemId,
        fields: [
          ...collectionOptions.watcherNotices.fields,
          {
            name: 'stage',
            label: 'New Stage',
          },
          { name: '_id', label: 'Unique ID' },
        ],
        data: {
          ...docData,
          stage: stageLabel,
          _id: watchersData?._id || itemId,
        },
        tenant,
        appOrigin: process.env.APP_URL || 'https://cristata.app',
      };

      const emailBody = writeWatcherEmailBody(bodySettings);
      const emailBodyMandatory = writeWatcherEmailBody({ ...bodySettings, isMandatory: true });
      const emailConfig = {
        defaultSender: `Cristata <noreply.${tenant}@notices.cristata.app>`,
        tenantDisplayName: emailInfo.tenantDisplayName,
        secrets: emailInfo.secrets.aws,
      };

      if (watchersEmails.length > 0) sendEmail(emailConfig, watchersEmails, subject, emailBody);
      if (mandatoryWatchersEmails.length > 0)
        sendEmail(emailConfig, mandatoryWatchersEmails, subject, emailBodyMandatory);
    }
  }

  return;
}

/**
 * Helper to flatten arrays of arrays of objects ids to a single array of object ids.
 */
function flatten(arr: mongoose.Types.ObjectId[][]): mongoose.Types.ObjectId[] {
  return arr.reduce((flat, toFlatten) => {
    return flat.concat(Array.isArray(toFlatten) ? toFlatten : [toFlatten]);
  }, []);
}

/**
 * Get watcher emails from the user ObjectIds inside an object property.
 * @param data the object containing the data, including the watcher propeties
 * @param keys an array of key names using dot notation that contain user object ids
 * @param usersCollection a mongodb collection for the User collection
 */
async function getWatcherEmails(
  data: Record<string, unknown>,
  keys: string[],
  usersCollection: mongodb.Collection<CollectionDoc>
) {
  // get the ids of the watchers with duplicates removed
  const watchersIds = Array.from(
    new Set(
      flatten(
        keys
          .map((key) => {
            const userIds = getProperty(data || {}, key);

            // tranform array of user ids to objectIds
            if (Array.isArray(userIds)) {
              return userIds
                .filter((id) => isObjectId(id))
                .map((id): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(id));
            }

            // if not an array, just transform the single value and put it in an array
            else if (isObjectId(userIds)) return [new mongoose.Types.ObjectId(userIds)];

            // or return an empty array
            return [];
          })
          .filter(notEmpty)
      ).map((id) => id.toHexString())
    )
  ).map((id): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(id));

  // get the emails of the watchers with duplicates removed
  const watchersEmails = Array.from(
    new Set(
      (
        await Promise.all(
          watchersIds.map(async (_id): Promise<string | undefined> => {
            // get the profile, which may contain an email
            const profile = await usersCollection.findOne({ _id });

            // return the email if it is a string
            if (profile && hasKey('email', profile) && typeof profile.email === 'string') {
              return profile.email;
            }
          })
        )
      ).filter(notEmpty)
    )
  );

  return watchersEmails;
}
