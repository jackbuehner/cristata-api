import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import('../models/shorturl.api.model');
import {
  getShortURL,
  getShortURLs,
  patchShortURL,
  newShortURL,
  deleteShortURL,
} from '../models/shorturl.api.model';
import { Teams } from '../../../config/database';
const shorturlRouter = Router();

enum Users {
  ANY = 0,
}

const permissions = {
  get: {
    teams: [Teams.ANY],
    users: [],
    isPublic: true,
  },
  post: {
    teams: [Teams.SHORTURL],
    users: [],
  },
  patch: {
    teams: [Teams.SHORTURL],
    users: [],
  },
  delete: {
    teams: [Teams.SHORTURL],
    users: [],
  },
};

async function handleAuth(
  req: Request,
  res: Response,
  permissionsType: string,
  callback: (user: IDeserializedUser) => unknown
) {
  try {
    if (req.isAuthenticated() || permissions[permissionsType].isPublic) {
      const user = req.isAuthenticated() ? (req.user as IDeserializedUser) : undefined;

      // check authorization
      let isAuthorized = false;
      if (
        permissions[permissionsType].teams.includes(Teams.ANY) |
        permissions[permissionsType].users.includes(Users.ANY)
      ) {
        // if `ANY` is specified in the permissions config for `permissionsType`
        isAuthorized = true;
      } else if (
        permissions[permissionsType].teams.some((team) => user.teams.includes(team)) ||
        permissions[permissionsType].users.includes(user._id)
      ) {
        // at least one of the user's teams  is inside the authorized teams array from the config
        // or the user's id is included in the users array in the config
        isAuthorized = true;
      }

      // if authorized, execute the callback; otherwise, send HTTP error 403 to the client (forbidden)
      if (isAuthorized) {
        callback(user);
      } else {
        res.status(403).send();
      }
    } else {
      res.status(403).send();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
}

shorturlRouter.post('/', async (req, res) =>
  handleAuth(req, res, 'post', (user) => newShortURL(req.body, user, res))
);
shorturlRouter.get('/', async (req, res) => handleAuth(req, res, 'get', () => getShortURLs(res)));
shorturlRouter.get('/:code', async (req, res) =>
  handleAuth(req, res, 'get', () => getShortURL(req.params.code, res))
);
shorturlRouter.patch('/:code', async (req, res) =>
  handleAuth(req, res, 'patch', (user) => patchShortURL(req.params.code, req.body, user, res))
);
shorturlRouter.delete('/:id', async (req, res) =>
  handleAuth(req, res, 'delete', (user) => deleteShortURL(req.params.id, user, res))
);

export { shorturlRouter };
