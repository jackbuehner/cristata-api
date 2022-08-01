import { Router } from 'express';
import fetch from 'node-fetch';
import { z } from 'zod';
import mongoose from 'mongoose';
import { IDeserializedUser } from '../../../passport';
import { requireAuth } from '../../../middleware/requireAuth';
import { requireConstantContactAuth } from '../../../middleware/requireConstantContactAuth';
import { IUser } from '../../../mongodb/users';

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
const router = Router();

router.get('/authorize', requireAuth, async (req, res) => {
  const endpoint = `https://authz.constantcontact.com/oauth2/default/v1/authorize`;

  const searchParams = new URLSearchParams();
  searchParams.set('client_id', CLIENT_ID);
  searchParams.set('redirect_uri', REDIRECT_URL);
  searchParams.set('response_type', 'code');
  searchParams.set('state', 'a');
  searchParams.set('scope', 'contact_data+offline_access');

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

      res.redirect('/auth');
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
        headers: { Authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    ).json();

    res.json(validator.parse(contact_lists));
  } catch (error) {
    console.error('Failed to get Constant Contact contact lists:', error);
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
        physical_address_in_footer: z.object({
          address_line1: z.string(),
          address_line2: z.string().optional(),
          address_line3: z.string().optional(),
          address_optional: z.string().optional(),
          city: z.string().optional(),
          country_code: z.string().length(2),
          organization_name: z.string(),
          postal_code: z.string(),
          state_code: z.string().length(2),
          state_non_us_name: z.string().optional(),
        }),
      })
      .array(),
  });

  const createEmailValidator = z.object({
    campaign_activities: z.object({ campaign_activity_id: z.string(), role: z.string() }).array(),
    campaign_id: z.string(),
    created_at: z.string(),
    current_status: z.literal('Draft'),
    name: z.string(),
    type: z.literal('NEWSLETTER'),
    type_code: z.number().int().positive(),
    updated_at: z.string(),
  });

  try {
    const body = bodyValidator.parse(req.body);

    // create a new email campaign
    const campaign = await (
      await fetch(BASE_URL + '/emails', {
        method: 'POST',
        headers: { Authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: JSON.stringify({ ...body, contact_list_ids: undefined, scheduled_date: undefined }),
      })
    ).json();

    // extract the primary campaign activity id from the new campaign
    const { campaign_activities } = createEmailValidator.parse(campaign);
    const campaign_activity_id = campaign_activities[0].campaign_activity_id;

    // update the campaign activity with the contact lists that should receive the campaign
    await fetch(BASE_URL + '/emails/activities/' + campaign_activity_id, {
      method: 'PUT',
      headers: { Authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify({ ...body, scheduled_date: undefined }),
    });

    // schedule the campaign to send on the specified time
    await fetch(BASE_URL + '/emails/activities/' + campaign_activity_id + '/schedules', {
      method: 'POST',
      headers: { Authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify({ scheduled_date: body.scheduled_date }),
    });

    res.status(200).end();
  } catch (error) {
    console.error('Failed to create and schedule new Constant Contact campaign:', error);
    res.status(500).end();
  }
});

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

export { router as constantContactRouter, refreshTokens as refreshConstantContactTokens };
