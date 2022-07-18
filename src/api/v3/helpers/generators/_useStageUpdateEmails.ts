import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { get as getProperty } from 'object-path';
import { Context } from '../../../../apollo';
import { hasKey } from '../../../../utils/hasKey';
import { isObjectId } from '../../../../utils/isObjectId';
import { sendEmail } from '../../../../utils/sendEmail';
import { GenResolversInput } from './genResolvers';

async function useStageUpdateEmails(
  context: Context,
  currentDoc: mongoose.Document,
  data: mongoose.LeanDocument<mongoose.Document>,
  gc: GenResolversInput
): Promise<void> {
  if (gc.options?.watcherNotices && gc.options.mandatoryWatchers) {
    const tenantDB = mongoose.connection.useDb(context.tenant, { useCache: true });
    const doc = merge(currentDoc, data);

    const flatten = (arr) => {
      return arr.reduce((flat, toFlatten) => {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
      }, []);
    };

    const mandatoryWatchersEmails = (
      await Promise.all(
        flatten(
          gc.options.mandatoryWatchers
            .map((key): mongoose.Types.ObjectId[] => {
              const users = getProperty(doc, key);
              if (Array.isArray(users)) {
                return users
                  .filter((user) => isObjectId(user))
                  .map((user): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(user));
              } else if (isObjectId(users)) return [new mongoose.Types.ObjectId(users)];
              return null;
            })
            .filter((x): x is mongoose.Types.ObjectId[] => !!x)
        ).map(async (_id) => {
          const profile = await tenantDB.model('User').findById(_id); // get the profile, which may contain an email
          if (profile && hasKey('email', profile)) return profile.email;
          return null;
        })
      )
    ).filter((x): x is string => !!x);

    const watchersEmails = (
      await Promise.all(
        //@ts-expect-error people exists on doc
        doc?.people?.watching?.map(async (_id) => {
          const profile = await tenantDB.model('User').findById(_id); // get the profile, which may contain an email
          if (hasKey('email', profile)) return profile.email;
          return null;
        })
      )
    )
      .filter((x): x is string => !!x)
      // exclude mandatory watchers so they are not double-emailed
      .filter((x) => !mandatoryWatchersEmails.includes(x));

    const subject = `[Stage: ${
      gc.options.watcherNotices.stageMap[doc[gc.options.watcherNotices.stageField]]
    }] ${getProperty(doc, gc.options.watcherNotices.subjectField)}`;

    const bodySettings = {
      model: gc.name,
      identifier: doc._id,
      fields: [
        ...gc.options.watcherNotices.fields,
        {
          name: gc.options.watcherNotices.stageField,
          label: 'New Stage',
          numMap: gc.options.watcherNotices.stageMap,
        },
        { name: '_id', label: 'Unique ID' },
      ],
      data: doc,
      context,
    };

    const emailBody = gc.helpers.writeEmailBody(bodySettings);
    const emailBodyMandatory = gc.helpers.writeEmailBody({ ...bodySettings, isMandatory: true });

    if (watchersEmails.length > 0) sendEmail(context.config, watchersEmails, subject, emailBody);
    if (mandatoryWatchersEmails.length > 0)
      sendEmail(context.config, mandatoryWatchersEmails, subject, emailBodyMandatory);
  }
}

export { useStageUpdateEmails };
