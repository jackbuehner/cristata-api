import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import { get as getProperty } from 'object-path';
import { Context } from '../../server';
import { hasKey } from '../../../utils/hasKey';
import { isObjectId } from '../../../utils/isObjectId';
import { sendEmail } from '../../../utils/sendEmail';
import { GenResolversInput } from './genResolvers';
import { TenantDB } from '../../../mongodb/TenantDB';
import { notEmpty } from '../../../utils/notEmpty';

async function useStageUpdateEmails(
  context: Context,
  currentDoc: mongoose.Document,
  data: mongoose.LeanDocument<mongoose.Document>,
  gc: GenResolversInput
): Promise<void> {
  if (gc.options?.watcherNotices && gc.options.mandatoryWatchers) {
    const tenantDB = new TenantDB(context.tenant, context.config.collections);
    await tenantDB.connect();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const User = (await tenantDB.model('User'))!;

    const doc = merge(currentDoc, data);

    const flatten = (arr: mongoose.Types.ObjectId[][]): mongoose.Types.ObjectId[] => {
      return arr.reduce((flat, toFlatten) => {
        return flat.concat(Array.isArray(toFlatten) ? flatten([toFlatten]) : toFlatten);
      }, []);
    };

    const mandatoryWatchersEmails = (
      await Promise.all(
        flatten(
          gc.options.mandatoryWatchers
            .map((key) => {
              const users = getProperty(doc, key);
              if (Array.isArray(users)) {
                return users
                  .filter((user) => isObjectId(user))
                  .map((user): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(user));
              } else if (isObjectId(users)) return [new mongoose.Types.ObjectId(users)];
              return [];
            })
            .filter(notEmpty)
        ).map(async (_id) => {
          const profile = await User.findById(_id); // get the profile, which may contain an email
          if (profile && hasKey('email', profile)) return profile.email;
          return null;
        })
      )
    ).filter((x): x is string => !!x);

    const watchersEmails = (
      await Promise.all(
        //@ts-expect-error people exists on doc
        doc?.people?.watching?.map(async (_id) => {
          const profile = await User.findById(_id); // get the profile, which may contain an email
          if (profile && hasKey('email', profile)) return profile.email;
          return null;
        })
      )
    )
      .filter((x): x is string => !!x)
      // exclude mandatory watchers so they are not double-emailed
      .filter((x) => !mandatoryWatchersEmails.includes(x));

    const stage =
      hasKey(gc.options.watcherNotices.stageField, doc) &&
      //@ts-expect-error this error is nonsense
      typeof doc[gc.options.watcherNotices.stageField] === 'number'
        ? //@ts-expect-error this error is nonsense
          (doc[gc.options.watcherNotices.stageField] as number)
        : undefined;

    const subject = `[Stage: ${stage}] ${getProperty(doc, gc.options.watcherNotices.subjectField)}`;

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
