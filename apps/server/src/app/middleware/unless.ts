import { NextHandleFunction } from 'connect';
import { NextFunction, Request, Response } from 'express-serve-static-core';

function unless(path: string, middleware: NextHandleFunction) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (path === req.path) {
      return next();
    } else {
      return middleware(req, res, next);
    }
  };
}

export { unless };
