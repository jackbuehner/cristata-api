import { replaceCircular } from '@jackbuehner/cristata-utils';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import aws from 'aws-sdk';
import Stripe from 'stripe';
import { TenantDB } from '../../mongodb/TenantDB';
import helpers, { requireAuthentication } from '../helpers';
import { Context } from '../server';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2020-08-27' });

const billing = {
  Query: {
    billing: async (
      _: never,
      __: never,
      context: Context
    ): Promise<{
      usage: Record<string, never>;
      features: Record<string, never>;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
      subscription_last_payment?: string;
      subscription_active: boolean;
    }> => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantDoc = await context.cristata.tenantsCollection?.findOne({
        name: context.tenant,
      });

      return {
        usage: {},
        features: {},
        stripe_customer_id: tenantDoc?.billing?.stripe_customer_id,
        stripe_subscription_id: tenantDoc?.billing?.stripe_subscription_id,
        subscription_last_payment: tenantDoc?.billing?.subscription_last_payment,
        subscription_active: tenantDoc?.billing?.subscription_active || false,
      };
    },
  },

  Usage: {
    api: async (_: unknown, { year, month }: { year?: number; month?: number }, context: Context) => {
      helpers.requireAuthentication(context);

      try {
        if (year === undefined && month === undefined) {
          const tenantDoc = await context.cristata.tenantsCollection?.findOne({ name: context.tenant });
          const subscriptionId = tenantDoc?.billing.stripe_subscription_id;

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            if (subscription.status !== 'canceled' && tenantDoc.billing.stripe_subscription_items?.api_usage) {
              const billableApiUsage = tenantDoc.billing.stripe_subscription_items.api_usage
                ? await stripe.subscriptionItems
                    .listUsageRecordSummaries(tenantDoc.billing.stripe_subscription_items.api_usage.id, {
                      limit: 1,
                    })
                    .then(({ data }) => data[0].total_usage)
                : 0;

              const internalApiUsage = tenantDoc.billing.stripe_subscription_items.app_usage
                ? await stripe.subscriptionItems
                    .listUsageRecordSummaries(tenantDoc.billing.stripe_subscription_items.app_usage.id, {
                      limit: 1,
                    })
                    .then(({ data }) => data[0].total_usage)
                : 0;

              return {
                billable: billableApiUsage,
                total: internalApiUsage,
                since: new Date(subscription.current_period_start * 1000).toISOString(),
              };
            }
          }
        }

        year = new Date().getUTCFullYear();
        month = new Date().getUTCMonth() + 1;

        const foundMonthMetrics = (
          await context.cristata.tenantsCollection?.findOne({
            [`billing.metrics.${year}.${month}`]: { $exists: true },
          })
        )?.billing?.metrics?.[year]?.[month];

        if (!foundMonthMetrics) return null;

        const calculatedMonthMetrics = Object.values(foundMonthMetrics).reduce(
          (sum, day) => {
            return {
              billable: (sum?.billable || 0) + (day?.billable || 0),
              total: (sum?.total || 0) + (day?.total || 0),
            };
          },
          { billable: 0, total: 0 }
        );

        return {
          billable: calculatedMonthMetrics?.billable || 0,
          total: calculatedMonthMetrics?.total || 0,
          since: new Date(year, month, 1).toISOString(),
        };
      } catch (error) {
        console.error(error);
        context.cristata.logtail.error(JSON.stringify(replaceCircular(error)));
      }
    },
    storage: async (
      _: unknown,
      __: unknown,
      context: Context
    ): Promise<{ database: number; files: number }> => {
      helpers.requireAuthentication(context);

      const tenantDB = new TenantDB(context.tenant, context.config.collections);
      const conn = await tenantDB.connect();

      const bucket =
        context.tenant === 'paladin-news' ? 'paladin-photo-library' : `app.cristata.${context.tenant}.photos`;
      const s3Size = await calcS3Storage(bucket, {
        accessKeyId: process.env.AWS_SECRET_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      });

      return {
        database: (await conn.db.stats()).dataSize,
        files: s3Size,
      };
    },
  },

  BillingFeatures: {
    allowDiskUse: async (_: never, __: never, context: Context): Promise<boolean> => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantDoc = await context.cristata.tenantsCollection?.findOne({
        name: context.tenant,
      });

      const stripe_customer_id = tenantDoc?.billing.stripe_customer_id;
      if (!stripe_customer_id) throw new ApolloError('could not find customer id', 'CUSTOMER_DETAILS_MISSING');

      const stripe_subscription_id = tenantDoc?.billing.stripe_subscription_id;
      if (!stripe_subscription_id)
        throw new ApolloError('could not find subscription id', 'SUBSCRIPTION_DETAILS_MISSING');

      const stripe_subscription_items = tenantDoc?.billing.stripe_subscription_items;
      if (!stripe_subscription_items)
        throw new ApolloError('could not find subscription items', 'SUBSCRIPTION_DETAILS_MISSING');

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2020-08-27' });
      const subscription = await stripe.subscriptions.retrieve(stripe_subscription_id);

      const allow_disk_usage_item = subscription.items.data.find((item) => {
        return item.price.id === 'price_1MKrYOHoKn7kS1oWZkpAF3eK';
      });

      if (allow_disk_usage_item) return true;
      return false;
    },
  },

  Mutation: {
    billing: () => {
      return {
        features: {},
      };
    },
  },

  MutationBilling: {
    features: () => {
      return {
        allowDiskUse: {},
      };
    },
  },

  MutationBillingFeatures: {
    allowDiskUse: async (
      _: never,
      { allowDiskUse }: { allowDiskUse: boolean },
      context: Context
    ): Promise<boolean> => {
      requireAuthentication(context);
      const isAdmin = context.profile?.teams.includes('000000000000000000000001');
      if (!isAdmin) throw new ForbiddenError('you must be an administrator');

      const tenantDoc = await context.cristata.tenantsCollection?.findOne({
        name: context.tenant,
      });

      const stripe_subscription_id = tenantDoc?.billing.stripe_subscription_id;
      if (!stripe_subscription_id)
        throw new ApolloError('could not find subscription id', 'SUBSCRIPTION_DETAILS_MISSING');

      const stripe_subscription_items = tenantDoc?.billing.stripe_subscription_items;
      if (!stripe_subscription_items)
        throw new ApolloError('could not find subscription items', 'SUBSCRIPTION_DETAILS_MISSING');

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2020-08-27' });
      const subscription = await stripe.subscriptions.retrieve(stripe_subscription_id);
      const subscriptionDiskUseItem = subscription.items.data.find((item) => {
        return item.price.id === 'price_1MKrYOHoKn7kS1oWZkpAF3eK';
      });

      if (subscriptionDiskUseItem && allowDiskUse) return true;
      if (!subscriptionDiskUseItem && !allowDiskUse) return false;

      const updatedSubscription = await stripe.subscriptions.update(stripe_subscription_id, {
        metadata: {
          tenant: context.tenant,
        },
        items: [
          {
            id: subscriptionDiskUseItem?.id,
            price: 'price_1MKrYOHoKn7kS1oWZkpAF3eK',
            deleted: allowDiskUse === false,
          },
        ],
      });
      return !!updatedSubscription.items.data.find((item) => {
        return item.price.id === 'price_1MKrYOHoKn7kS1oWZkpAF3eK';
      });
    },
  },
};

async function calcS3Storage(bucket: string, credentials: { accessKeyId: string; secretAccessKey: string }) {
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
