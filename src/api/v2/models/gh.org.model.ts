import axios, { AxiosError, AxiosResponse } from 'axios';
import { Response } from 'express';
import { IProfile } from '../../../passport';

/**
 * Send the appropriate error code and message
 * @param err the Axios eror
 * @param res expess response (optional; needed to tell client that request was recieved and handled)
 */
function handleError(err: AxiosError, res: Response) {
  console.error(err);
  if (err.response) {
    // server responded 4xx/5xx error code
    console.error(err.response.data);
    if (res) res.status(err.response.status).json(err.response.data).end();
  } else if (err.request) {
    // request was mode, but a response was not recieved
    console.error(err.request.data);
    if (res) res.status(504).end();
  } else {
    // othrwise, something bad happened
    console.error(err);
    if (res) res.status(500).end();
  }
}

/**
 * Create an invitation for a user by email.
 */
async function postOrgInvitation(user: IProfile, res: Response = null): Promise<void> {
  const approvedEmail = user.emails.find(
    (email) => email.includes('@thepaladin.news') || email.includes('@furman.edu')
  );

  console.log(`${process.env.GITHUB_ADMIN_USERNAME}:${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`);

  if (approvedEmail) {
    axios
      .post(
        '/orgs/paladin-news/invitations',
        { email: approvedEmail },
        {
          baseURL: 'https://api.github.com',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Basic ${Buffer.from(
              `${process.env.GITHUB_ADMIN_USERNAME}:${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`
            ).toString('base64')}`,
          },
        }
      )
      .then(({ data }: AxiosResponse) => {
        if (res) res.json(data);
      })
      .catch((err: AxiosError) => handleError(err, res));
  } else {
    if (res) res.status(403).end();
  }
}

export { postOrgInvitation };
