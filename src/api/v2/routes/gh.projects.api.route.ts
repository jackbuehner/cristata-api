import { Router, Request, Response } from 'express';
import { IDeserializedUser } from '../../../passport';
import {
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
  moveProjectCard,
  updateProjectCard,
  createProjectCard,
  deleteProjectCard,
} from '../models/gh.projects.api.model';
const projectsRouter = Router();

function handleErrors(res: Response, callback: () => void) {
  try {
    callback();
  } catch {
    res.status(400);
  }
}

// get a project
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  getProject(req.params.id, req.user as IDeserializedUser, res);
});

// patch a project
projectsRouter.patch('/:id', async (req: Request, res: Response) => {
  updateProject(
    req.params.id,
    req.body.name,
    req.body.body,
    req.body.state,
    req.user as IDeserializedUser,
    res
  );
});

// get a project, it's columns, and the columns' cards
projectsRouter.get('/full/:id', async (req: Request, res: Response) => {
  getFullProject(req.params.id, req.user as IDeserializedUser, res);
});

// get all columns in a project
projectsRouter.get('/:id/columns', async (req: Request, res: Response) => {
  getProjectColumns(req.params.id, req.user as IDeserializedUser, res);
});

// create a project column
projectsRouter.post('/:id/columns', async (req: Request, res: Response) => {
  createProjectColumn(req.params.id, req.body.name, req.user as IDeserializedUser, res);
});

// get a project column
projectsRouter.get('/columns/:id', async (req: Request, res: Response) => {
  getProjectColumn(req.params.id, req.user as IDeserializedUser, res);
});

// rename a project column
projectsRouter.patch('/columns/:id', async (req: Request, res: Response) => {
  renameProjectColumn(req.params.id, req.body.name, req.user as IDeserializedUser, res);
});

// delete a project column
projectsRouter.delete('/columns/:id', async (req: Request, res: Response) => {
  deleteProjectColumn(req.params.id, req.user as IDeserializedUser, res);
});

// get all cards in a project column
projectsRouter.get('/columns/:id/cards', async (req: Request, res: Response) => {
  getProjectCards(req.params.id, req.user as IDeserializedUser, res);
});

// get a project card
projectsRouter.get('/columns/cards/:id', async (req: Request, res: Response) => {
  getProjectCard(req.params.id, req.user as IDeserializedUser, res);
});

// create a card in a project column
projectsRouter.post('/columns/:id/cards', async (req: Request, res: Response) => {
  handleErrors(res, () => createProjectCard(req.params.id, req.body.note, req.user as IDeserializedUser, res));
});

// move project card
projectsRouter.post('/columns/cards/:id/move', async (req: Request, res: Response) => {
  moveProjectCard(req.params.id, req.body.column_id, req.body.position, req.user as IDeserializedUser, res);
});

// update project card
projectsRouter.patch('/columns/cards/:id', async (req: Request, res: Response) => {
  updateProjectCard(req.params.id, req.body.note, req.body.archived, req.user as IDeserializedUser, res);
});

// delete project card
projectsRouter.delete('/columns/cards/:id', async (req: Request, res: Response) => {
  deleteProjectCard(req.params.id, req.user as IDeserializedUser, res);
});

export { projectsRouter };
