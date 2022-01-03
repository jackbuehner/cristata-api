import axios, { AxiosError, AxiosResponse } from 'axios';
import { Response } from 'express';
import { IDeserializedUser } from '../../../passport';

/**
 * Send the appropriate error code and message
 * @param err the Axios eror
 * @param res expess response (optional; needed to tell client that request was recieved and handled)
 */
function handleError(err: AxiosError, res: Response) {
  if (err.response) {
    // server responded 4xx/5xx error code
    console.error(err.response.data);
    if (res) res.status(err.response.status).json(err.response.data).end();
  } else if (err.request) {
    // request was mode, but a response was not recieved
    console.error(err.response.data);
    if (res) res.status(504).end();
  } else {
    // othrwise, something bad happened
    console.error(err);
    if (res) res.status(500).end();
  }
}

/**
 * Get a list of projects in the organization
 */
async function getOrgProjects(user: IDeserializedUser, res: Response = null): Promise<void> {
  axios
    .get('/orgs/paladin-news/projects', {
      baseURL: 'https://api.github.com',
      headers: {
        //Accept: 'application/vnd.github.v3+json',
        Accept: 'application/vnd.github.inertia-preview+json', // preview required for projects api
        Authorization: `Bearer ${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`,
      },
    })
    .then(({ data }: AxiosResponse) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

export { getOrgProjects };
