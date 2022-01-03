import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import('../models/photoRequests.api.model');
import {
  newPhotoRequest,
  getPhotoRequests,
  getPhotoRequest,
  patchPhotoRequest,
  deletePhotoRequest,
} from '../models/photoRequests.api.model';
const photoRequestsRouter = Router();

/**
 * Returns true if the object is a profile match the `IDeserializedUser` interface.
 * This is called a type predicate. It helps the typescript compiler know the
 * type of the object.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function instanceOfProfile(object): object is IDeserializedUser {
  return 'member' in object;
}

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
  post: {
    teams: [Teams.ANY],
    users: [],
  },
  patch: {
    teams: [Teams.ANY],
    users: [],
  },
  delete: {
    teams: [Teams.ADMIN],
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
    if (req.isAuthenticated()) {
      const user = req.user as IDeserializedUser;

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

photoRequestsRouter.post('/', async (req, res) =>
  handleAuth(req, res, 'post', (user) => newPhotoRequest(req.body, user, res))
);
photoRequestsRouter.get('/', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getPhotoRequests(user, req.query as unknown as URLSearchParams, res))
);
photoRequestsRouter.get('/:id', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getPhotoRequest(req.params.id, user, res))
);
photoRequestsRouter.patch('/:id', async (req, res) =>
  handleAuth(req, res, 'patch', (user) => patchPhotoRequest(req.params.id, req.body, user, res))
);
photoRequestsRouter.delete('/:id', async (req, res) =>
  handleAuth(req, res, 'delete', (user) => deletePhotoRequest(req.params.id, user, res))
);

export { photoRequestsRouter };
