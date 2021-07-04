import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import('../models/photos.api.model');
import { newPhoto, getPhotos, getPhoto, patchPhoto, deletePhoto } from '../models/photos.api.model';
const photosRouter = Router();

/**
 * Returns true if the object is a profile match the `IProfile` interface.
 * This is called a type predicate. It helps the typescript compiler know the
 * type of the object.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function instanceOfProfile(object): object is IProfile {
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
  callback: (user: IProfile) => unknown
) {
  try {
    if (req.isAuthenticated()) {
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

photosRouter.post('/', async (req, res) =>
  handleAuth(req, res, 'post', (user) => newPhoto(req.body, user, res))
);
photosRouter.get('/', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getPhotos(user, req.query as unknown as URLSearchParams, res))
);
photosRouter.get('/:id', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getPhoto(req.params.id, user, res))
);
photosRouter.patch('/:id', async (req, res) =>
  handleAuth(req, res, 'patch', (user) => patchPhoto(req.params.id, req.body, user, res))
);
photosRouter.delete('/:id', async (req, res) =>
  handleAuth(req, res, 'delete', (user) => deletePhoto(req.params.id, user, res))
);

export { photosRouter };
