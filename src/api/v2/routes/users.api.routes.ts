import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import '../../../mongodb/users.model';
import {
  getUsers,
  getUser,
  patchUser,
  getUserPhoto,
  getPublicUser,
  getPublicUsers,
} from '../models/users.api.model';
const usersRouter = Router();

enum Teams {
  ADMIN = 'MDQ6VGVhbTQ2NDI0MTc=',
  ANY = 'any',
}

enum Users {
  ANY = 0,
}

const permissions = {
  get: {
    teams: [Teams.ANY],
    users: [],
  },
  patch: {
    teams: [Teams.ADMIN], // the user can still patch their own profile
    users: [],
  },
  getPublic: {
    teams: [Teams.ANY],
    users: [Users.ANY],
    isPublic: true,
  },
};

async function handleAuth(
  req: Request,
  res: Response,
  permissionsType: string,
  callback: (user: IProfile) => unknown
) {
  try {
    if (req.isAuthenticated() || permissions[permissionsType].isPublic) {
      const user = req.user as IProfile;

      // check authorization
      let isAuthorized = false;
      if (
        permissions[permissionsType].teams.includes(Teams.ANY) |
        permissions[permissionsType].users.includes(Users.ANY)
      ) {
        // if `ANY` is specified in the permissions config for `permissionsType`
        isAuthorized = true;
      } else if (
        permissions[permissionsType].teams.some((team: string) => user.teams.includes(team)) ||
        permissions[permissionsType].users.includes(user.id)
      ) {
        // at least one of the user's teams  is inside the authorized teams array from the config
        // or the user's id is included in the users array in the config
        isAuthorized = true;
      } else if (permissionsType === 'patch' && req.params.user_id.split('_')[1] === user.id) {
        // if the user is trying patch their own profile, allow them
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

usersRouter.get('/', async (req, res) => handleAuth(req, res, 'get', () => getUsers(res)));
usersRouter.get('/public', async (req, res) =>
  handleAuth(req, res, 'getPublic', () => getPublicUsers(req.query as unknown as URLSearchParams, res))
);
usersRouter.get('/public/:user_slug', async (req, res) =>
  handleAuth(req, res, 'getPublic', () => getPublicUser(req.params.user_slug, res))
);
usersRouter.get('/:user_id/photo', async (req, res) =>
  handleAuth(req, res, 'get', (authUser) => getUserPhoto(req.params.user_id, authUser, res))
);
usersRouter.get('/:user_id', async (req, res) =>
  handleAuth(req, res, 'get', (authUser) => getUser(req.params.user_id, authUser, res))
);
usersRouter.patch('/:user_id', async (req, res) =>
  handleAuth(req, res, 'patch', (authUser) =>
    patchUser(req.params.user_id.split('_')[0], req.params.user_id.split('_')[1], req.body, authUser, res)
  )
);

export { usersRouter };
