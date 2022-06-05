import { ForbiddenError } from 'apollo-server-errors';
import { Context } from '../../../apollo';
import { requireAuthentication } from '../helpers';
import mongoose from 'mongoose';
import aws from 'aws-sdk';

const billing = {
  Query: {
    billing: async (
      _: never,
      __: never,
      context: Context
    ): Promise<{
      usage: Record<string, never>;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
      subscription_last_payment?: string;
      subscription_active: boolean;
    }> => {
      requireAuthentication(context);
      const isAdmin = context.profile.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantDoc = await context.cristata.tenantsCollection.findOne({
        name: context.tenant,
      });

      return {
        usage: {},
        stripe_customer_id: tenantDoc?.billing?.stripe_customer_id,
        stripe_subscription_id: tenantDoc?.billing?.stripe_subscription_id,
        subscription_last_payment: tenantDoc?.billing?.subscription_last_payment,
        subscription_active: tenantDoc?.billing?.subscription_active || false,
      };
    },
  },

  Usage: {
    api: async (_: unknown, { year, month }: { year: number; month: number }, context: Context) => {
      const foundMonthMetrics = (
        await context.cristata.tenantsCollection.findOne({
          [`billing.metrics.${year}.${month}`]: { $exists: true },
        })
      )?.billing?.metrics?.[year]?.[month];

      if (!foundMonthMetrics) return null;

      const calculatedMonthMetrics = Object.values(foundMonthMetrics).reduce((sum, day) => {
        return {
          billable: (sum.billable || 0) + (day.billable || 0),
          total: (sum.total || 0) + (day.total || 0),
        };
      });

      return {
        billable: calculatedMonthMetrics.billable || 0,
        total: calculatedMonthMetrics.total || 0,
      };
    },
    storage: async (
      _: unknown,
      __: unknown,
      context: Context
    ): Promise<{ database: number; files: number }> => {
      const tenantDB = mongoose.connection.useDb(context.tenant, { useCache: true });
      const s3Size = await calcS3Storage('paladin-photo-library', context.config.secrets.aws);

      return {
        database: (await tenantDB.db.stats()).dataSize,
        files: s3Size,
      };
    },
  },
};

async function calcS3Storage(bucket: string, credentials: Context['config']['secrets']['aws']) {
  const cw = new aws.CloudWatch({ credentials });
  const params = {
    Namespace: 'AWS/S3',
    MetricName: 'BucketSizeBytes',
    StartTime: (() => {
      const startTime = new Date(Date.now() - 3600 * 24 * 1000 * 1.5);
      startTime.setUTCHours(0);
      startTime.setUTCMinutes(0);
      startTime.setUTCSeconds(0);
      return startTime;
    })(),
    EndTime: new Date(),
    Period: 3600,
    Dimensions: [
      {
        Name: 'BucketName',
        Value: bucket,
      },
      {
        Name: 'StorageType',
        Value: 'StandardStorage',
      },
    ],
    Statistics: ['Average'],
    Unit: 'Bytes',
  };
  const s3Size = await new Promise(
    (resolve: (value: number) => unknown, reject: (reason: aws.AWSError) => void) => {
      cw.getMetricStatistics(params, (err, data) => {
        if (err) reject(err);
        else resolve(data.Datapoints?.[0]?.Average || 0);
      });
    }
  );

  return s3Size;
}

export { billing, calcS3Storage };
