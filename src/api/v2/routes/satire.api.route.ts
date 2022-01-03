import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import('../models/satire.api.model');
import { EnumSatireStage } from '../../../mongodb/satire.model';
import {
  deleteSatire,
  getSatire,
  getSatires,
  getPublicSatires,
  getPublicSatire,
  newSatire,
  patchSatire,
  getStageCounts,
} from '../models/satire.api.model';
const satireRouter = Router();

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
  publish: {
    teams: [Teams.ADMIN],
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
  callback: (user: IDeserializedUser, canPublish: boolean) => unknown
) {
  try {
    if (req.isAuthenticated() || permissions[permissionsType].isPublic) {
      const user = req.isAuthenticated() ? (req.user as IDeserializedUser) : undefined;

      // check if the user can publish (automatically false if user undefined)
      const canPublish = user
        ? permissions['publish'].teams.some((team: string) => user.teams.includes(team)) ||
          permissions['publish'].users.includes(user._id)
        : false;

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

      // if the satire stage is changing to published/uploaded OR it contains a published date, consider authorized only if user has publish permissions
      const isStageUploadedOrPublished =
        req.body?.stage === (EnumSatireStage.UPLOADED || EnumSatireStage.PUBLISHED);
      const hasPublishedTimestamp = req.body?.timestamps?.published ? true : false;
      if ((isStageUploadedOrPublished || hasPublishedTimestamp) && !canPublish) isAuthorized = false;

      // if authorized, execute the callback; otherwise, send HTTP error 403 to the client (forbidden)
      if (isAuthorized) {
        callback(user, canPublish);
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

satireRouter.post('/', async (req, res) =>
  handleAuth(req, res, 'post', (user) => newSatire(req.body, user, res))
);
satireRouter.get('/', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getSatires(user, req.query as unknown as URLSearchParams, res))
);
satireRouter.get('/permissions', async (req, res) =>
  handleAuth(req, res, 'publish', (user, canPublish) => {
    res.json({
      canPublish: canPublish,
    });
  })
);
satireRouter.get('/stage-counts', async (req, res) => handleAuth(req, res, 'get', () => getStageCounts(res)));
satireRouter.get(
  '/public',
  async (
    req,
    res // public, published satire that can appear for anyone
  ) => handleAuth(req, res, 'getPublic', () => getPublicSatires(req.query as unknown as URLSearchParams, res))
);
satireRouter.get(
  '/public/:slug',
  async (
    req,
    res // public, published satire that can appear for anyone
  ) => handleAuth(req, res, 'getPublic', () => getPublicSatire(req.params.slug, res))
);
satireRouter.get('/:id', async (req, res) =>
  handleAuth(req, res, 'get', (user) =>
    getSatire(req.params.id, req.query.by ? req.query.by.toString() : null, user, res)
  )
);
satireRouter.patch('/:id', async (req, res) =>
  handleAuth(req, res, 'patch', (user, canPublish) =>
    patchSatire(req.params.id, req.body, user, canPublish, res)
  )
);
satireRouter.delete('/:id', async (req, res) =>
  handleAuth(req, res, 'delete', (user, canPublish) => deleteSatire(req.params.id, user, canPublish, res))
);

export { satireRouter };
