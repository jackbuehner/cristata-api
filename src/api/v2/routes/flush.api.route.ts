import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import {
  getDocument,
  getDocuments,
  newDocument,
  patchDocument,
  watchDocument,
} from '../models/flush.api.model';
const router = Router();

enum Teams {
  ADMIN = 'MDQ6VGVhbTQ2NDI0MTc=',
  FLUSH = 'T_kwDOBCVTT84AUIJM',
  ANY = 'any',
}

enum Users {
  ANY = 0,
}

const permissions = {
  get: {
    teams: [Teams.FLUSH],
    users: [],
  },
  post: {
    teams: [Teams.FLUSH],
    users: [],
  },
  patch: {
    teams: [Teams.FLUSH],
    users: [],
  },
  publish: {
    teams: [Teams.FLUSH],
    users: [],
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

      // if the article stage is changing to published/uploaded OR it contains a published date, consider authorized only if user has publish permissions
      const hasPublishedTimestamp = !!req.body?.timestamps?.published_at;
      if (hasPublishedTimestamp && !canPublish) isAuthorized = false;

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

router.post('/', async (req, res) => handleAuth(req, res, 'post', (user) => newDocument(req.body, user, res)));
router.get('/', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getDocuments(user, req.query as unknown as URLSearchParams, res))
);
router.get('/permissions', async (req, res) =>
  handleAuth(req, res, 'publish', (user, canPublish) => {
    res.json({
      canPublish: canPublish,
    });
  })
);
router.get('/:id', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getDocument(req.params.id, user, res))
);
router.patch('/:id/watch', async (req, res) =>
  handleAuth(req, res, 'patch', (user) => watchDocument(req.params.id, user, req.body.watch, res))
);
router.patch('/:id', async (req, res) =>
  handleAuth(req, res, 'patch', (user, canPublish) =>
    patchDocument(req.params.id, req.body, user, canPublish, res)
  )
);

export { router as flushRouter };
