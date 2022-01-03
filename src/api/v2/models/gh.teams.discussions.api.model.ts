import dotenv from 'dotenv';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Response } from 'express';
import { IDeserializedUser } from '../../../passport';

// load environmental variables
dotenv.config();

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
 * Get the first 10 discussions in a team.
 *
 * Includes:
 * - author
 * - reactions
 * - title
 * - body HTML
 * - publish and updtae timestamps
 * - viewer permissions
 * - pinned status
 * - private status
 * - number of comments
 *
 * DOES NOT INCLUDE COMMENTS
 */
async function getTeamDiscussions(
  teamSlug: string,
  last = '10',
  before: string | undefined,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  let result;
  await GHPAxios.post(
    `https://api.github.com/graphql`,
    {
      query: `
      {
        organization(login: "${process.env.GITHUB_ORG_LOGIN}") {
          team(slug: "${teamSlug}") {
            discussions(last: ${last}${before ? `, before: "${before}"` : ``}) {
              totalCount
              edges {
                cursor
                node {
                  id
                  author {
                    login
                  }
                  bodyHTML
                  comments(last: 50, orderBy: {field: NUMBER, direction: DESC}) {
                    totalCount
                    edges {
                      node {
                        author {
                          login
                        }
                        createdAt
                      }
                    }
                  }
                  lastEditedAt
                  isPrivate
                  isPinned
                  publishedAt
                  reactions {
                    totalCount
                  }
                  title
                  updatedAt
                  viewerCanDelete
                  viewerCanPin
                  viewerCanReact
                  viewerCanSubscribe
                  viewerCanUpdate
                  viewerCannotUpdateReasons
                  viewerDidAuthor
                  viewerSubscription
                  number
                  editor {
                    login
                  }
                  reactionGroups {
                    content
                    viewerHasReacted
                    users {
                      totalCount
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
        Authorization: `Bearer ${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`,
      },
    }
  )
    .then(({ data }: AxiosResponse) => {
      result = data;
    })
    .catch((err: AxiosError) => handleError(err, res));
  if (res) res.json(result.data);
}

/**
 * Get a single discussion from a team
 */
async function getTeamDiscussion(
  teamSlug: string,
  discussionNumber: string,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  let result;
  await GHPAxios.post(
    `https://api.github.com/graphql`,
    {
      query: `
      {
        organization(login: "${process.env.GITHUB_ORG_LOGIN}") {
          team(slug: "${teamSlug}") {
            discussion(number: ${discussionNumber}) {
              id
              author {
                login
              }
              bodyHTML
              comments(last: 50, orderBy: {field: NUMBER, direction: DESC}) {
                totalCount
                edges {
                  node {
                    author {
                      login
                    }
                    createdAt
                  }
                }
              }
              lastEditedAt
              isPrivate
              isPinned
              publishedAt
              reactions {
                totalCount
              }
              title
              updatedAt
              viewerCanDelete
              viewerCanPin
              viewerCanReact
              viewerCanSubscribe
              viewerCanUpdate
              viewerCannotUpdateReasons
              viewerDidAuthor
              viewerSubscription
              number
              editor {
                login
              }
              reactionGroups {
                content
                viewerHasReacted
                users {
                  totalCount
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
        Authorization: `Bearer ${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`,
      },
    }
  )
    .then(({ data }: AxiosResponse) => {
      result = data;
    })
    .catch((err: AxiosError) => handleError(err, res));
  if (res) res.json(result.data);
}

/**
 * Get the first 100 comments from a discussion
 */
async function getTeamDiscussionComments(
  teamSlug: string,
  discussionNumber: string,
  user: IDeserializedUser,
  res: Response = null
): Promise<void> {
  let result;
  await GHPAxios.post(
    `https://api.github.com/graphql`,
    {
      query: `
      {
        organization(login: "${process.env.GITHUB_ORG_LOGIN}") {
          team(slug: "${teamSlug}") {
            discussion(number: ${discussionNumber}) {
              comments(first: 100) {
                edges {
                  cursor
                  node {
                    id
                    author {
                      login
                    }
                    bodyHTML
                    publishedAt
                    lastEditedAt
                    viewerCanDelete
                    viewerCanUpdate
                    viewerCanReact
                    viewerCannotUpdateReasons
                    number
                    editor {
                      login
                    }
                    reactionGroups {
                      content
                      viewerHasReacted
                      users {
                        totalCount
                      }
                    }
                    reactions {
                      totalCount
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
        Authorization: `Bearer ${process.env.GITHUB_ADMIN_PERSONAL_ACCESS_TOKEN}`,
      },
    }
  )
    .then(({ data }: AxiosResponse) => {
      result = data;
    })
    .catch((err: AxiosError) => handleError(err, res));
  if (res) res.json(result.data);
}

export { getTeamDiscussions, getTeamDiscussion, getTeamDiscussionComments };
