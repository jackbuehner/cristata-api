import { hasKey, isObject } from '@jackbuehner/cristata-utils';
import express, { Router } from 'express';
import Stripe from 'stripe';
import Cristata from '../../Cristata';
import { requireAdmin } from '../../app/middleware/requireAdmin';
import { IDeserializedUser } from '../passport';

const coreCostPrices = {
  legacy: 'price_1L7SECHoKn7kS1oW6JrXN7AI',
  free: 'price_1MwXajHoKn7kS1oWclo873Tt',
  professional: 'price_1MwXcFHoKn7kS1oWUHYrRR11',
  premium: 'price_1MwXczHoKn7kS1oW6mDDUtvY',
};

/**
 * This router contains the routes for stripe.
 */
function factory(cristata: Cristata): Router {
  const router = Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2020-08-27' });

  // handle stripe payments
  router.post('/stripe/create-checkout-session', requireAdmin, async (req, res) => {
    try {
      // get the document with all tenant information and configuration
      const tenantDoc = await cristata.tenantsCollection?.findOne({
        name: (req.user as IDeserializedUser).tenant,
      });

      // get the core cost price mode
      const mode = (req.query as unknown as URLSearchParams).get('coreCostMode');

      // create a Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        billing_address_collection: 'auto',
        line_items: [
          {
            // core cost
            price:
              mode === 'free' || mode === 'professional' || mode === 'premium'
                ? coreCostPrices[mode || 'premium']
                : coreCostPrices.premium,
            quantity: 1,
          },
          {
            // photo and file storage
            price: 'price_1L7SE5HoKn7kS1oWTY4igElZ',
          },
          {
            // mongodb
            price: 'price_1L7SE9HoKn7kS1oWC1BTOlev',
          },
          {
            // api usage (external)
            price: 'price_1L7SEHHoKn7kS1oWXmCOLF8F',
          },
          {
            // cristata.app api usage (internal)
            price: 'price_1L7SDiHoKn7kS1oWnaahztcK',
          },
          {
            // premium integrations and custom fields/previews
            price: 'price_1L7SDPHoKn7kS1oWb18xRVXN',
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 2,
        },
        phone_number_collection: { enabled: true },
        success_url: `${process.env.APP_URL}/configuration/billing/payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/configuration/billing/payments?canceled=true`,
        automatic_tax: { enabled: true },
        customer: tenantDoc?.billing.stripe_customer_id, // if the customer already exists, do not create a new customer
        metadata: {
          tenant: (req.user as IDeserializedUser).tenant,
        },
      });

      if (session.url) {
        res.redirect(303, session.url);
      } else res.status(403).send();
    } catch (error) {
      console.error(error);
    }
  });

  // create a portal session for managing the subscription via Stripe
  router.post('/stripe/create-portal-session', requireAdmin, async (req, res) => {
    try {
      // get the document with all tenant information and configuration
      const tenantDoc = await cristata.tenantsCollection?.findOne({
        name: (req.user as IDeserializedUser).tenant,
      });

      // get the stripe customer id so it can be used to create a stripe portal session
      const customerId = tenantDoc?.billing.stripe_customer_id;

      if (customerId) {
        // create a portal session and redirect to it
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: process.env.APP_URL,
        });
        res.redirect(303, portalSession.url);
      } else {
        // payment required: the customer does not exist because there has never been a payment
        res.status(402).send();
      }
    } catch (error) {
      console.error(error);
      res.status(500).send();
    }
  });

  // listen for stripe webhooks to update tenant subscriptions
  router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event | undefined = undefined;

    try {
      if (signature && endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return res.status(400).send(`⚠️  Webhook signature verification failed: ${error.message}`);
      } else {
        return res.status(400).send(`⚠️  Webhook signature verification failed`);
      }
    }

    // Extract the object from the event.
    const data = event?.data;
    const eventType = event?.type;

    if (data?.object && eventType && cristata.tenantsCollection) {
      switch (eventType) {
        case 'checkout.session.completed':
          // Payment is successful and the subscription is created.
          if (
            hasKey('metadata', data.object) &&
            isObject(data.object.metadata) &&
            hasKey('tenant', data.object.metadata) &&
            typeof data.object.metadata.tenant === 'string' &&
            hasKey('customer', data.object) &&
            typeof data.object.customer === 'string' &&
            hasKey('subscription', data.object) &&
            typeof data.object.subscription === 'string'
          ) {
            try {
              const tenant = data.object.metadata.tenant;
              const customerId = data.object.customer;
              const subscriptionId = data.object.subscription;
              const nowISO = new Date().toISOString();

              // get the subscription item ids from the subscription
              // so we can update the usage of the metered usage items
              // as needed
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const subItems = subscription.items.data;
              const coreCostItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6R5i02xdW8cD') || null;
              const fileStorageItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QsCWpOAPGtu') || null;
              const databaseItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6Rh3tUVYRCCq') || null;
              const apiUsageItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6RMiFbCxbO3a') || null;
              const cristataAppUsageItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QZrB2Wa9zq4') || null;
              const integrationsItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QhM2v3AoJiA') || null;
              const allowDiskUseItem =
                subItems.find((sub) => sub.plan.product === 'prod_N51bDi1B5W71bY') || null;

              // determine the core subscription mode
              const [coreCostItemMode]: [string | undefined, string | undefined] = Object.entries(
                coreCostPrices
              ).find(([, priceId]) => {
                if (priceId === coreCostItem?.price.id) return true;
                return false;
              }) || [undefined, undefined];

              // store the subscription and customer details in the tenant data object
              await cristata.tenantsCollection.findOneAndUpdate(
                {
                  name: tenant,
                },
                {
                  $set: {
                    'billing.stripe_customer_id': customerId,
                    'billing.stripe_subscription_id': subscriptionId,
                    'billing.subscription_active': true,
                    'billing.subscription_last_payment': nowISO,
                    'billing.stripe_subscription_items.core.id': coreCostItem?.id,
                    'billing.stripe_subscription_items.core.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.core.mode': coreCostItemMode,
                    'billing.stripe_subscription_items.file_storage.id': fileStorageItem?.id,
                    'billing.stripe_subscription_items.file_storage.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.database_usage.id': databaseItem?.id,
                    'billing.stripe_subscription_items.database_usage.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.api_usage.id': apiUsageItem?.id,
                    'billing.stripe_subscription_items.api_usage.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.app_usage.id': cristataAppUsageItem?.id,
                    'billing.stripe_subscription_items.app_usage.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.integrations.id': integrationsItem?.id,
                    'billing.stripe_subscription_items.integrations.usage_reported_at': nowISO,
                    'billing.stripe_subscription_items.allow_disk_use.id': allowDiskUseItem?.id,
                    'billing.stripe_subscription_items.allow_disk_use.usage_reported_at': nowISO,
                  },
                }
              );

              // immediately update the tenant pay status
              cristata.hasTenantPaid[tenant] = true;
            } catch (error) {
              console.error(`Failed to update tenant after checkout.session.completed`, error);
              if (error instanceof Error) {
                return res
                  .status(400)
                  .send(`⚠️  Failed to update tenant after checkout.session.completed: ${error.message}`);
              }
              return res.status(400).send(`⚠️  Failed to update tenant after checkout.session.completed`);
            }
          }
          break;
        case 'invoice.paid':
          // provision the tenant when a subscription payment is fulfilled.
          if (
            hasKey('customer', data.object) &&
            typeof data.object.customer === 'string' &&
            hasKey('subscription', data.object) &&
            typeof data.object.subscription === 'string'
          ) {
            try {
              const customer = data.object.customer;
              const subscription = data.object.subscription;

              // store the subscription and customer details in the tenant data object
              const tenantDoc = await cristata.tenantsCollection?.findOneAndUpdate(
                {
                  'billing.stripe_customer_id': customer,
                  'billing.stripe_subscription_id': subscription,
                },
                {
                  $set: {
                    'billing.subscription_active': true,
                    'billing.subscription_last_payment': new Date().toISOString(),
                  },
                }
              );

              // immediately update the tenant pay status
              const tenantName = tenantDoc.value?.name;
              if (tenantName) cristata.hasTenantPaid[tenantName] = true;
            } catch (error) {
              console.error(`Failed to update tenant after invoice.paid`, error);
              if (error instanceof Error) {
                return res.status(400).send(`⚠️  Failed to update tenant after invoice.paid: ${error.message}`);
              }
              return res.status(400).send(`⚠️  Failed to update tenant after invoice.paid`);
            }
          }
          break;
        case 'invoice.payment_failed':
          // deprovision if the payment failed or the customer does not have a valid payment method.
          if (
            hasKey('customer', data.object) &&
            typeof data.object.customer === 'string' &&
            hasKey('subscription', data.object) &&
            typeof data.object.subscription === 'string'
          ) {
            try {
              const customer = data.object.customer;
              const subscription = data.object.subscription;

              // store the subscription and customer details in the tenant data object
              const tenantDoc = await cristata.tenantsCollection?.findOneAndUpdate(
                {
                  'billing.stripe_customer_id': customer,
                  'billing.stripe_subscription_id': subscription,
                },
                {
                  $set: {
                    'billing.subscription_active': false,
                  },
                }
              );

              // immediately update the tenant pay status
              const tenantName = tenantDoc.value?.name;
              if (tenantName) cristata.hasTenantPaid[tenantName] = false;
            } catch (error) {
              console.error(`Failed to update tenant after invoice.payment_failed`, error);
              if (error instanceof Error) {
                return res
                  .status(400)
                  .send(`⚠️  Failed to update tenant after invoice.payment_failed: ${error.message}`);
              }
              return res.status(400).send(`⚠️  Failed to update tenant after invoice.payment_failed`);
            }
          }
          break;
        case 'customer.subscription.deleted':
          // deprovision if the subscription is deleted.
          if (
            hasKey('customer', data.object) &&
            typeof data.object.customer === 'string' &&
            hasKey('id', data.object) &&
            typeof data.object.id === 'string'
          ) {
            try {
              const customer = data.object.customer;
              const subscription = data.object.id;

              // store the subscription and customer details in the tenant data object
              const tenantDoc = await cristata.tenantsCollection.findOneAndUpdate(
                {
                  'billing.stripe_customer_id': customer,
                  'billing.stripe_subscription_id': subscription,
                },
                {
                  $set: {
                    'billing.subscription_active': false,
                  },
                }
              );

              // immediately update the tenant pay status
              const tenantName = tenantDoc.value?.name;
              if (tenantName) cristata.hasTenantPaid[tenantName] = false;
            } catch (error) {
              console.error(`Failed to update tenant after customer.subscription.deleted`, error);
              if (error instanceof Error) {
                return res
                  .status(400)
                  .send(`⚠️  Failed to update tenant after customer.subscription.deleted: ${error.message}`);
              }
              return res.status(400).send(`⚠️  Failed to update tenant after customer.subscription.deleted`);
            }
          }
          break;
        case 'customer.subscription.updated':
          // Payment is successful and the subscription is created.
          if (
            hasKey('metadata', data.object) &&
            isObject(data.object.metadata) &&
            hasKey('tenant', data.object.metadata) &&
            typeof data.object.metadata.tenant === 'string' &&
            hasKey('customer', data.object) &&
            typeof data.object.customer === 'string' &&
            hasKey('id', data.object) &&
            typeof data.object.id === 'string'
          ) {
            try {
              const tenant = data.object.metadata.tenant;
              const customerId = data.object.customer;
              const subscriptionId = data.object.id;

              // get the subscription item ids from the subscription
              // so we can update the usage of the metered usage items
              // as needed
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const subItems = subscription.items.data;
              const coreCostItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6R5i02xdW8cD') || null;
              const fileStorageItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QsCWpOAPGtu') || null;
              const databaseItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6Rh3tUVYRCCq') || null;
              const apiUsageItem = subItems.find((sub) => sub.plan.product === 'prod_Lp6RMiFbCxbO3a') || null;
              const cristataAppUsageItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QZrB2Wa9zq4') || null;
              const integrationsItem =
                subItems.find((sub) => sub.plan.product === 'prod_Lp6QhM2v3AoJiA') || null;
              const allowDiskUseItem =
                subItems.find((sub) => sub.plan.product === 'prod_N51bDi1B5W71bY') || null;

              // store the subscription and customer details in the tenant data object
              await cristata.tenantsCollection.findOneAndUpdate(
                {
                  name: tenant,
                },
                {
                  $set: {
                    'billing.stripe_customer_id': customerId,
                    'billing.stripe_subscription_id': subscriptionId,
                    'billing.subscription_active': true,
                    'billing.stripe_subscription_items.core.id': coreCostItem?.id,
                    'billing.stripe_subscription_items.file_storage.id': fileStorageItem?.id,
                    'billing.stripe_subscription_items.database_usage.id': databaseItem?.id,
                    'billing.stripe_subscription_items.api_usage.id': apiUsageItem?.id,
                    'billing.stripe_subscription_items.app_usage.id': cristataAppUsageItem?.id,
                    'billing.stripe_subscription_items.integrations.id': integrationsItem?.id,
                    'billing.stripe_subscription_items.allow_disk_use.id': allowDiskUseItem?.id,
                  },
                }
              );

              // immediately update the tenant pay status
              cristata.hasTenantPaid[tenant] = true;
            } catch (error) {
              console.error(`Failed to update tenant after checkout.session.completed`, error);
              if (error instanceof Error) {
                return res
                  .status(400)
                  .send(`⚠️  Failed to update tenant after checkout.session.updated: ${error.message}`);
              }
              return res.status(400).send(`⚠️  Failed to update tenant after checkout.session.updated`);
            }
          }
          break;
        default:
        // Unhandled event type
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  });

  return router;
}

export { factory as stripeRouterFactory };
