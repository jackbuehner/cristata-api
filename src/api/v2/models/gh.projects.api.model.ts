import axios, { AxiosError, AxiosResponse } from 'axios';
import { Response } from 'express';
import { IProfile } from '../../../passport';

// create axios instance for GitHub projects
const GHPAxios = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    //Accept: 'application/vnd.github.v3+json',
    Accept: 'application/vnd.github.inertia-preview+json', // preview required for projects api
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
 * Get a project from the GitHub projects API
 *
 * @param id project ID
 * @param user express user profile
 * @param res express response object
 */
async function getProject(
  id: string,
  user: IProfile,
  res: Response = null,
  callback: (data: unknown) => unknown = null
): Promise<void> {
  GHPAxios.get(`/projects/${id}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
      callback(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Edit a GitHub project
 *
 * @param id project ID
 * @param name project name
 * @param body project description
 * @param state open or closed
 * @param user express user profile
 * @param res express response object
 */
async function updateProject(
  id: string,
  name: string,
  body: string,
  state: 'open' | 'closed',
  user: IProfile,
  res: Response = null,
  callback: (data: unknown) => unknown = null
): Promise<void> {
  GHPAxios.patch(
    `/projects/${id}`,
    {
      name: name,
      body: body,
      state: state,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then(({ data }) => {
      if (res) res.json(data);
      if (callback) callback(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Get a project's columns from the GitHub projects API
 *
 * @param id project ID
 * @param user express user profile
 * @param res express response object
 */
async function getProjectColumns(
  id: string,
  user: IProfile,
  res: Response = null,
  callback: (data: Column[]) => unknown = null
): Promise<void> {
  GHPAxios.get(`/projects/${id}/columns`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
      callback(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Create a project column via the GitHub projects API
 *
 * @param project_id column ID
 * @param name new column name
 * @param user express user profile
 * @param res express response object
 */
async function createProjectColumn(
  project_id: string,
  name: string,
  user: IProfile,
  res: Response = null
): Promise<void> {
  GHPAxios.post(
    `/projects/${project_id}/columns`,
    {
      name: name,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then(({ data }) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Get a project column from the GitHub projects API
 *
 * @param column_id column ID
 * @param user express user profile
 * @param res express response object
 */
async function getProjectColumn(column_id: string, user: IProfile, res: Response = null): Promise<void> {
  GHPAxios.get(`/projects/columns/${column_id}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Rename a project column from the GitHub projects API
 *
 * @param column_id column ID
 * @param name new column name
 * @param user express user profile
 * @param res express response object
 */
async function renameProjectColumn(
  column_id: string,
  name: string,
  user: IProfile,
  res: Response = null
): Promise<void> {
  GHPAxios.patch(
    `/projects/columns/${column_id}`,
    {
      name: name,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then(({ data }) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Delete a project column from the GitHub projects API
 *
 * @param column_id column ID
 * @param user express user profile
 * @param res express response object
 */
async function deleteProjectColumn(column_id: string, user: IProfile, res: Response = null): Promise<void> {
  GHPAxios.delete(`/projects/columns/${column_id}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Get cards in a column from the GitHub projects API
 *
 * @param column_id column ID
 * @param user express user profile
 * @param res express response object
 */
async function getProjectCards(
  column_id: string,
  user: IProfile,
  res: Response = null,
  callback: (data: Card[]) => unknown = null
): Promise<void> {
  GHPAxios.get(`/projects/columns/${column_id}/cards`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
      callback(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Get card from the GitHub projects API
 *
 * @param card_id card ID
 * @param user express user profile
 * @param res express response object
 */
async function getProjectCard(card_id: string, user: IProfile, res: Response = null): Promise<void> {
  GHPAxios.get(`/projects/columns/cards/${card_id}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then(({ data }) => {
      if (res) res.json(data);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Post a new card to the GitHub projects API
 *
 * @param column_id column ID
 * @param note card note
 * @param user express user profile
 * @param res express response object
 */
async function createProjectCard(
  column_id: string,
  note: string,
  user: IProfile,
  res: Response = null
): Promise<void> {
  GHPAxios.post(
    `/projects/columns/${column_id}/cards`,
    {
      note: note,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then((response: AxiosResponse) => {
      if (res) res.json(response.statusText);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Update a project card.
 *
 * @param card_id card ID
 * @param note card note
 * @param archived whether the card is archived
 * @param user express user profile
 * @param res express response object
 */
async function updateProjectCard(
  card_id: string,
  note: string | null,
  archived: boolean,
  user: IProfile,
  res: Response = null
): Promise<void> {
  GHPAxios.patch(
    `/projects/columns/cards/${card_id}`,
    {
      note: note,
      archived: archived,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then((response: AxiosResponse) => {
      if (res) res.json(response.statusText);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Delete a card.
 *
 * @param card_id card ID
 * @param user express user profile
 * @param res express response object
 */
async function deleteProjectCard(card_id: string, user: IProfile, res: Response = null): Promise<void> {
  GHPAxios.delete(`/projects/columns/cards/${card_id}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  })
    .then((response: AxiosResponse) => {
      if (res) res.json(response.statusText);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

/**
 * Move a card in a GitHub project
 *
 * @param card_id card ID
 * @param column_id the ID of the new column
 * @param position the new card position
 * @param user express user profile
 * @param res express response object
 */
async function moveProjectCard(
  card_id: string,
  column_id: string,
  position: 'top' | 'bottom' | string,
  user: IProfile,
  res: Response = null
): Promise<void> {
  GHPAxios.post(
    `/projects/columns/cards/${card_id}/moves`,
    {
      position: position,
      column_id: column_id,
    },
    {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    }
  )
    .then((response: AxiosResponse) => {
      if (res) res.json(response.statusText);
    })
    .catch((err: AxiosError) => handleError(err, res));
}

interface Project {
  owner_url: string;
  url: string;
  html_url: string;
  columns_url: string;
  id: number;
  node_id: string;
  name: string;
  body: string;
  number: number;
  state: string;
  creator: Creator;
  created_at: string;
  updated_at: string;
  organization_permission: string;
  private: boolean;
}

interface Creator {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
}

interface Column {
  url: string;
  project_url: string;
  cards_url: string;
  id: number;
  node_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  cards_loaded?: boolean;
}

interface Card {
  url: string;
  project_url: string;
  id: number;
  node_id: string;
  note?: string;
  archived: boolean;
  creator: Creator;
  created_at: string;
  updated_at: string;
  column_url: string;
  content_url?: string;
  issue: unknown;
}

interface FullCard extends Card {
  column_id: number;
}

interface FullColumn extends Column {
  cards?: FullCard[];
}

interface FullProject extends Project {
  columns?: FullColumn[];
}

/**
 * Get a project column from the GitHub projects API
 *
 * @param project_id project ID
 * @param user express user profile
 * @param res express response object
 */
async function getFullProject(project_id: string, user: IProfile, res: Response = null): Promise<void> {
  try {
    // store full project
    let fullProject: FullProject;
    // get the project
    await getProject(project_id, user, null, async (project_data: Project) => {
      // save to fullProject
      fullProject = project_data;

      // get the columns
      await getProjectColumns(project_id, user, null, async (column_data: Column[]) => {
        // save to fullProject
        fullProject.columns = column_data;

        // loop through each column and get associated cards
        for (let i = 0; i < fullProject.columns.length; i++) {
          const column = fullProject.columns[i];
          const columnId = fullProject.columns[i].id;
          // get the cards
          await getProjectCards(column.id.toString(), user, null, async (cards_data: Card[]) => {
            // add the column_id to each card
            const cards: FullCard[] = [];
            for (let c = 0; c < cards_data.length; c++) {
              cards.push({
                ...cards_data[c],
                column_id: columnId,
              });
            }

            // save to fullProject
            fullProject.columns[i].cards = cards;

            // if card is an issue, get the issue information
            for (let j = 0; j < fullProject.columns[i].cards.length; j++) {
              const card = fullProject.columns[i].cards[j];
              if (card.content_url) {
                await axios
                  .get(card.content_url, {
                    headers: {
                      Authorization: `Bearer ${user.accessToken}`,
                    },
                  })
                  .then(({ data }) => {
                    fullProject.columns[i].cards[j] = {
                      ...fullProject.columns[i].cards[j],
                      issue: data,
                    };
                  })
                  .catch((err: AxiosError) => handleError(err, res));
              }
            }

            fullProject.columns[i].cards_loaded = true;

            // send the project after the last card is fetched
            if (fullProject.columns.every((column) => column.cards_loaded === true)) {
              if (res) res.json(fullProject);
            }
          });
        }
      });
    });
  } catch (err) {
    console.error(err);
    if (res) res.status(500);
  }
}

export {
  getProject,
  updateProject,
  getProjectColumns,
  getProjectColumn,
  createProjectColumn,
  renameProjectColumn,
  deleteProjectColumn,
  getProjectCards,
  getProjectCard,
  getFullProject,
  createProjectCard,
  moveProjectCard,
  updateProjectCard,
  deleteProjectCard,
};
