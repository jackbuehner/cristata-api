import express, { Router } from 'express';
import Stripe from 'stripe';
import Cristata from './Cristata';
import { IDeserializedUser } from './passport';
import { hasKey } from './utils/hasKey';

/**
 * This router contains the routes for stripe.
 */
function factory(cristata: Cristata): Router {
  const router = Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-08-27' });

  // handle stripe payments
  router.post('/stripe/create-checkout-session', async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        const user = req.user as IDeserializedUser;
        const isAdmin = user.teams.includes('000000000000000000000001');

        if (isAdmin) {
          // get the document with all tenant information and configuration
          const tenantDoc = await cristata.tenantsCollection.findOne({
            name: user.tenant,
          });

          // create a Stripe checkout session
          const session = await stripe.checkout.sessions.create({
            billing_address_collection: 'auto',
            line_items: [
              {
                price: 'price_1L6kjiHoKn7kS1oWqfKScMNe',
                quantity: 1,
              },
              {
                price: 'price_1L7MkuHoKn7kS1oWFi3d1BBm',
              },
              {
                price: 'price_1L7M76HoKn7kS1oWITu15nqR',
              },
              {
                price: 'price_1L71k0HoKn7kS1oWlx7Slxcb',
              },
            ],
            mode: 'subscription',
            phone_number_collection: { enabled: true },
            success_url: `${process.env.APP_URL}/configuration/billing/payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/configuration/billing/payments?canceled=true`,
            automatic_tax: { enabled: true },
            customer: tenantDoc.billing.stripe_customer_id, // if the customer already exists, do not create a new customer
            metadata: {
              tenant: user.tenant,
            },
          });

          res.redirect(303, session.url);
        } else res.status(403).send();
      } else res.status(401).send();
    } catch (error) {
      console.error(error);
    }
  });

  // create a portal session for managing the subscription via Stripe
  router.post('/stripe/create-portal-session', async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        const isAdmin = (req.user as IDeserializedUser).teams.includes('000000000000000000000001');
        if (isAdmin) {
          // get the document with all tenant information and configuration
          const tenantDoc = await cristata.tenantsCollection.findOne({
            name: (req.user as IDeserializedUser).tenant,
          });

          // get the stripe customer id so it can be used to create a stripe portal session
          const customerId = tenantDoc.billing.stripe_customer_id;

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
        } else {
          // unauthorized: user must be an admin
          res.status(403).send();
        }
      } else {
        // unauthenticated: user must be authenticated
        res.status(401).send();
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

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
    } catch (error) {
      console.error(error);
      return res.status(400).send(`⚠️  Webhook signature verification failed: ${error.message}`);
    }

    // Extract the object from the event.
    const data = event.data;
    const eventType = event.type;

    switch (eventType) {
      case 'checkout.session.completed':
        // Payment is successful and the subscription is created.
        if (
          hasKey('metadata', data.object) &&
          typeof data.object.metadata === 'object' &&
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
            const subscriptionItems = subscription.items.data;
            const coreCostItem = subscriptionItems.find((sub) => sub.plan.product === 'prod_LoNUf3MIbVhegG');
            const fileStorageItem = subscriptionItems.find((sub) => sub.plan.product === 'prod_LoNbPOQgizef9O');
            const databaseItem = subscriptionItems.find((sub) => sub.plan.product === 'prod_LoNWSsMWaUMGHv');
            const apiUsageItem = subscriptionItems.find((sub) => sub.plan.product === 'prod_LoNSaiLK2VfUVZ');

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
                  'billing.stripe_subscription_items.core.id': coreCostItem.id,
                  'billing.stripe_subscription_items.core.usage_reported_at': nowISO,
                  'billing.stripe_subscription_items.file_storage.id': fileStorageItem.id,
                  'billing.stripe_subscription_items.file_storage.usage_reported_at': nowISO,
                  'billing.stripe_subscription_items.database_usage.id': databaseItem.id,
                  'billing.stripe_subscription_items.database_usage.usage_reported_at': nowISO,
                  'billing.stripe_subscription_items.api_usage.id': apiUsageItem.id,
                  'billing.stripe_subscription_items.api_usage.usage_reported_at': nowISO,
                },
              }
            );
          } catch (error) {
            console.error(`Failed to update tenant after checkout.session.completed`, error);
            return res
              .status(400)
              .send(`⚠️  Failed to update tenant after checkout.session.completed: ${error.message}`);
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
            await cristata.tenantsCollection.findOneAndUpdate(
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
          } catch (error) {
            console.error(`Failed to update tenant after invoice.paid`, error);
            return res.status(400).send(`⚠️  Failed to update tenant after invoice.paid: ${error.message}`);
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
            await cristata.tenantsCollection.findOneAndUpdate(
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
          } catch (error) {
            console.error(`Failed to update tenant after invoice.payment_failed`, error);
            return res
              .status(400)
              .send(`⚠️  Failed to update tenant after invoice.payment_failed: ${error.message}`);
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
            await cristata.tenantsCollection.findOneAndUpdate(
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
          } catch (error) {
            console.error(`Failed to update tenant after customer.subscription.deleted`, error);
            return res
              .status(400)
              .send(`⚠️  Failed to update tenant after customer.subscription.deleted: ${error.message}`);
          }
        }
        break;
      default:
      // Unhandled event type
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  });

  return router;
}

export { factory as stripeRouterFactory };