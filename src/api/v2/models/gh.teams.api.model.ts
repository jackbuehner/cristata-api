import axios, { AxiosError } from 'axios';
import { Response } from 'express';
import { IProfile } from '../../../passport';

// create axios instance for GitHub projects
const GHPAxios = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Content-Type': 'application/json',
    'GraphQL-Features': 'discussions_api',
  },
});

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
 * Get the first 100 teams and each team's first 100 child teams from a GitHub
 * organization.
 */
async function getTeams(user: IProfile, res: Response = null): Promise<void> {
  let result;
  await GHPAxios.post(
    `https://api.github.com/graphql`,
    {
      query: `
      {
        organization(login: "paladin-news") {
          teams(first: 100, rootTeamsOnly: true) {
            edges {
              node {
                id
                slug
                childTeams(first: 100) {
                  edges {
                    node {
                      id
                      slug
                    }
                  }
                }
              }
            }
          }
        }
      }      
    `,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then(({ data }) => {
      result = data;
    })
    .catch((err: AxiosError) => handleError(err, res));
  if (res) res.json(result.data);
}

export { getTeams };
