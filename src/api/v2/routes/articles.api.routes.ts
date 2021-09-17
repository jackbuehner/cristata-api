import { Router, Request, Response } from 'express';
import { IProfile } from '../../../passport';
import('../models/articles.api.model');
import { EnumArticleStage } from '../../../mongodb/articles.model';
import {
  deleteArticle,
  getArticle,
  getArticles,
  getPublicArticles,
  getPublicArticle,
  newArticle,
  patchArticle,
  getStageCounts,
  watchArticle,
} from '../models/articles.api.model';
const articlesRouter = Router();

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
  callback: (user: IProfile, canPublish: boolean) => unknown
) {
  try {
    if (req.isAuthenticated() || permissions[permissionsType].isPublic) {
      const user = req.isAuthenticated() ? (req.user as IProfile) : undefined;

      // check if the user can publish (automatically false if user undefined)
      const canPublish = user
        ? permissions['publish'].teams.some((team: string) => user.teams.includes(team)) ||
          permissions['publish'].users.includes(user.id)
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
        permissions[permissionsType].users.includes(user.id)
      ) {
        // at least one of the user's teams  is inside the authorized teams array from the config
        // or the user's id is included in the users array in the config
        isAuthorized = true;
      }

      // if the article stage is changing to published/uploaded OR it contains a published date, consider authorized only if user has publish permissions
      const isStageUploadedOrPublished =
        req.body?.stage === (EnumArticleStage['Uploaded/Scheduled'] || EnumArticleStage.Published);
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

articlesRouter.post('/', async (req, res) =>
  handleAuth(req, res, 'post', (user) => newArticle(req.body, user, res))
);
articlesRouter.get('/', async (req, res) =>
  handleAuth(req, res, 'get', (user) => getArticles(user, req.query as unknown as URLSearchParams, res))
);
articlesRouter.get('/permissions', async (req, res) =>
  handleAuth(req, res, 'publish', (user, canPublish) => {
    res.json({
      canPublish: canPublish,
    });
  })
);
articlesRouter.get('/stage-counts', async (req, res) => handleAuth(req, res, 'get', () => getStageCounts(res)));
articlesRouter.get(
  '/public',
  async (
    req,
    res // public, published articles that can appear for anyone
  ) => handleAuth(req, res, 'getPublic', () => getPublicArticles(req.query as unknown as URLSearchParams, res))
);
articlesRouter.get(
  '/public/:slug',
  async (
    req,
    res // public, published article that can appear for anyone
  ) => handleAuth(req, res, 'getPublic', () => getPublicArticle(req.params.slug, res))
);
articlesRouter.get('/:id', async (req, res) =>
  handleAuth(req, res, 'get', (user) =>
    getArticle(req.params.id, req.query.by ? req.query.by.toString() : null, user, res)
  )
);
articlesRouter.patch('/:id/watch', async (req, res) =>
  handleAuth(req, res, 'patch', (user) => watchArticle(req.params.id, user, req.body.watch, res))
);
articlesRouter.patch('/:id', async (req, res) =>
  handleAuth(req, res, 'patch', (user, canPublish) =>
    patchArticle(req.params.id, req.body, user, canPublish, res)
  )
);
articlesRouter.delete('/:id', async (req, res) =>
  handleAuth(req, res, 'delete', (user, canPublish) => deleteArticle(req.params.id, user, canPublish, res))
);

export { articlesRouter };
