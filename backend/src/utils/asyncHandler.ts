import { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Every controller in this codebase used to repeat the same try/catch/res.status(500)
// boilerplate. This wrapper forwards thrown/rejected errors to the centralized
// error handler instead, so controllers can just `await` and throw.
export const asyncHandler = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
