import { Router } from 'express';
import fetch from 'node-fetch';
import { z } from 'zod';
import mongoose from 'mongoose';
import { IDeserializedUser } from '../../../passport';
import { requireAuth } from '../middleware/requireAuth';
import { requireConstantContactAuth } from '../middleware/requireConstantContactAuth';
import { IUser } from '../../../mongodb/users';
import Cristata from '../../../Cristata';

const CLIENT_ID = process.env.CONSTANT_CONTACT_CLIENT_ID;
const CLIENT_SECRET = process.env.CONSTANT_CONTACT_CLIENT_SECRET;
const BASIC_AUTH = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
const BASE_URL = `https://api.cc.email/v3`;
const REDIRECT_URL = (() => {
  if (process.env.GITPOD_WORKSPACE_URL && process.env.PORT) {
    return `${process.env.GITPOD_WORKSPACE_URL.replace(
      'https://',
      `https://${process.env.PORT}-`
    )}/v3/constant-contact/auth-response`;
  }
  return `https://api.thepaladin.cristata.app/v3/constant-contact/auth-response`;
})();

/**
 * Router for constant contact endpoints.
 */
function factory(cristata: Cristata): Router {
  const router = Router();

  router.get('/authorize', requireAuth, async (req, res) => {
    const endpoint = `https://authz.constantcontact.com/oauth2/default/v1/authorize`;

    const searchParams = new URLSearchParams();
    searchParams.set('client_id', CLIENT_ID);
    searchParams.set('redirect_uri', REDIRECT_URL);
    searchParams.set('response_type', 'code');
    searchParams.set('state', 'a');
    searchParams.set('scope', 'account_read+contact_data+campaign_data+offline_access');

    res.redirect(endpoint + '?' + searchParams.toString().replace(/%2B/g, '+'));
  });

  router.get('/auth-response', requireAuth, async (req, res) => {
    const searchParams = req.query as unknown as URLSearchParams;

    const error = searchParams.get('error');
    if (error) {
      res.status(500).json({ error });
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      const tokens = await getTokens(code);
      if (tokens) {
        // store the tokens in the user
        const user = req.user as IDeserializedUser;
        storeTokens(user.tenant, user._id, tokens.access_token, tokens.refresh_token, tokens.expires_in);

        res.send('<script>window.close();</script > ');
        return;
      }
    }

    res.status(500).end();
  });

  router.get('/contact_lists', requireConstantContactAuth, async (req, res) => {
    const validator = z.object({
      lists: z
        .object({
          list_id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          favorite: z.boolean().optional(),
          created_at: z.string(),
          updated_at: z.string(),
          membership_count: z.number().int().positive(),
        })
        .array(),
      lists_count: z.number().int().positive(),
      _links: z
        .object({
          next: z.object({ href: z.string() }).optional(),
        })
        .optional(),
    });

    try {
      const Authorization = `Bearer ${(req.user as IDeserializedUser).constantcontact.access_token}`;

      const contact_lists = await (
        await fetch(BASE_URL + '/contact_lists?limit=50&include_count=true', {
          headers: { Authorization, 'Content-Type': 'application/json' },
        })
      ).json();

      const validated = validator.parse(contact_lists);

      res.json({
        ...validated,
        lists: validated.lists
          .sort((a, b) => a.name.localeCompare(b.name))
          .sort((a, b) => (a.favorite && !b.favorite ? -1 : 1)),
      });
    } catch (error) {
      console.error('Failed to get Constant Contact contact lists:', error);
      res.status(500).end();
    }
  });

  router.get('/account_emails', requireConstantContactAuth, async (req, res) => {
    const validator = z
      .object({
        email_id: z.number().int().positive(),
        email_address: z.string().max(80),
        confirm_status: z.literal('CONFIRMED').or(z.literal('UNCONFIRMED')),
        confirm_time: z.string().optional(), // not available until email is confirmed
        confirm_source_type: z
          .union([
            z.literal('SITE_OWNER'),
            z.literal('SUPPORT'),
            z.literal('FORCEVERIFY'),
            z.literal('PARTNER'),
          ])
          .optional(), // not available until email is confirmed
        roles: z
          .union([
            z.literal('CONTACT'),
            z.literal('BILLING'),
            z.literal('JOURNALING'),
            z.literal('REPLY_TO'),
            z.literal('OTHER'),
          ])
          .array(),
        pending_roles: z
          .union([
            z.literal('CONTACT'),
            z.literal('BILLING'),
            z.literal('JOURNALING'),
            z.literal('REPLY_TO'),
            z.literal('OTHER'),
          ])
          .array()
          .optional(), // not available on account emails created a long time ago
      })
      .array();

    try {
      const Authorization = `Bearer ${(req.user as IDeserializedUser).constantcontact.access_token}`;

      const account_emails = await (
        await fetch(BASE_URL + '/account/emails?' + req.query.toString(), {
          headers: { Authorization, 'Content-Type': 'application/json' },
        })
      ).json();

      res.json(validator.parse(account_emails).sort((a, b) => a.email_address.localeCompare(b.email_address)));
    } catch (error) {
      console.error('Failed to get Constant Contact account senders:', error);
      res.status(500).end();
    }
  });

  router.post('/emails', requireConstantContactAuth, async (req, res) => {
    const Authorization = `Bearer ${(req.user as IDeserializedUser).constantcontact.access_token}`;

    const bodyValidator = z.object({
      name: z.string().max(80),
      contact_list_ids: z.string().array(),
      scheduled_date: z.string(),
      email_campaign_activities: z
        .object({
          format_type: z.literal(5),
          from_name: z.string().max(100),
          from_email: z.string().max(80),
          reply_to_email: z.string().max(80),
          subject: z.string(),
          preheader: z.string().optional(),
          html_content: z.string().max(150000),
          physical_address_in_footer: z
            .object({
              address_line1: z.string().optional(),
              address_line2: z.string().optional(),
              address_line3: z.string().optional(),
              address_optional: z.string().optional(),
              city: z.string().optional(),
              country_code: z.string().length(2),
              organization_name: z.string(),
              postal_code: z.string(),
              state_code: z.string().length(2),
              state_non_us_name: z.string().optional(),
            })
            .optional(),
        })
        .array(),
    });

    const createEmailValidator = z.object({
      campaign_activities: z.object({ campaign_activity_id: z.string(), role: z.string() }).array(),
      campaign_id: z.string(),
      created_at: z.string(),
      current_status: z.literal('Draft'),
      name: z.string(),
      type: z.literal('CUSTOM_CODE_EMAIL'),
      type_code: z.number().int().positive(),
      updated_at: z.string(),
    });

    try {
      const user = req.user as IDeserializedUser;

      const body = bodyValidator.parse(req.body);

      // insert the account's physical address if none was provided
      if (!body.email_campaign_activities[0].physical_address_in_footer) {
        const physicalAddress = await getPhysicalAddress(Authorization);
        body.email_campaign_activities[0].physical_address_in_footer = {
          address_line1: physicalAddress.address_line1,
          address_line2: physicalAddress.address_line2,
          address_line3: physicalAddress.address_line3,
          city: physicalAddress.city,
          country_code: physicalAddress.country_code,
          postal_code: physicalAddress.postal_code,
          state_code: physicalAddress.state_code,
          state_non_us_name: physicalAddress.state_name,
          organization_name: cristata.config[user.tenant].tenantDisplayName,
        };
      }

      // create a new email campaign
      const campaign = await (
        await fetch(BASE_URL + '/emails', {
          method: 'POST',
          headers: { Authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, contact_list_ids: undefined, scheduled_date: undefined }),
        })
      ).json();

      // extract the primary campaign activity id from the new campaign
      const { campaign_activities } = createEmailValidator.parse(campaign);
      const campaign_activity_id = campaign_activities[0].campaign_activity_id;

      // update the campaign activity with the contact lists that should receive the campaign
      await fetch(BASE_URL + '/emails/activities/' + campaign_activity_id, {
        method: 'PUT',
        headers: { Authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body.email_campaign_activities[0], contact_list_ids: body.contact_list_ids }),
      });

      // schedule the campaign to send on the specified time
      await fetch(BASE_URL + '/emails/activities/' + campaign_activity_id + '/schedules', {
        method: 'POST',
        headers: { Authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: body.scheduled_date }),
      });

      res.json({
        details: `https://app.constantcontact.com/pages/campaigns/email-details/details/activity/${campaign_activity_id}`,
        report: `https://app.constantcontact.com/pages/campaigns/email-details/reporting/activity/${campaign_activity_id}`,
      });
    } catch (error) {
      console.error('Failed to create and schedule new Constant Contact campaign:', error);
      res.status(500).end();
    }
  });

  return router;
}

async function getTokens(authorization_code: string) {
  const codeReqParams = new URLSearchParams();
  codeReqParams.set('code', authorization_code);
  codeReqParams.set('redirect_uri', REDIRECT_URL);
  codeReqParams.set('grant_type', 'authorization_code');

  const validator = z.object({
    token_type: z.literal('Bearer'),
    expires_in: z.number().int().positive(),
    access_token: z.string(),
    scope: z.string(),
    refresh_token: z.string(),
    id_token: z.string().optional(),
  });

  const res = await (
    await fetch(`https://authz.constantcontact.com/oauth2/default/v1/token?${codeReqParams}`, {
      method: 'POST',
      headers: {
        Authorization: BASIC_AUTH,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  ).json();

  return validator.parse(res);
}

async function getRefreshedTokens(refresh_token: string) {
  const codeReqParams = new URLSearchParams();
  codeReqParams.set('refresh_token', refresh_token);
  codeReqParams.set('grant_type', 'refresh_token');

  const validator = z.object({
    token_type: z.literal('Bearer'),
    expires_in: z.number().int().positive(),
    access_token: z.string(),
    scope: z.string(),
    refresh_token: z.string(),
  });

  const res = await (
    await fetch(`https://authz.constantcontact.com/oauth2/default/v1/token?${codeReqParams}`, {
      method: 'POST',
      headers: {
        Authorization: BASIC_AUTH,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  ).json();

  return validator.parse(res);
}

async function refreshTokens(tenant: string, user_id: mongoose.Types.ObjectId, refresh_token: string) {
  const tokens = await getRefreshedTokens(refresh_token);
  storeTokens(tenant, user_id, tokens.access_token, tokens.refresh_token, tokens.expires_in);
}

async function storeTokens(
  tenant: string,
  user_id: mongoose.Types.ObjectId,
  access_token: string,
  refresh_token: string,
  expires_in: number
) {
  try {
    // store the tokens in the user
    const tenantDB = mongoose.connection.useDb(tenant, { useCache: true });
    const user = await tenantDB.model<IUser>('User').findById(user_id);
    user.constantcontact = {
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: new Date().getTime() + expires_in,
    };
    await user.save();
  } catch (error) {
    console.error(`Failed to to save Constant Contact tokens to user ${user_id}`, error);
  }
}

async function getPhysicalAddress(Authorization: string) {
  const validator = z.object({
    address_line1: z.string().max(80),
    address_line2: z.string().max(80).optional(),
    address_line3: z.string().max(80).optional(),
    city: z.string(),
    state_code: z.string().length(2).optional(),
    state_name: z.string().optional(),
    postal_code: z.string().optional(),
    country_code: z.string().length(2),
  });

  const res = await (
    await fetch(BASE_URL + '/account/summary/physical_address', {
      headers: { Authorization, 'Content-Type': 'application/json' },
    })
  ).json();

  return validator.parse(res);
}

export { factory as constantContactRouterFactory, refreshTokens as refreshConstantContactTokens };
