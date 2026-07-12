import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../utils/httpError';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Supabase/Postgrest errors are plain objects ({ message, details, hint, code }),
// not `Error` instances, so `err instanceof Error` misses them entirely and used
// to collapse every database error to a generic, identical 500 message.
interface PostgrestLikeError {
  message: string;
  code?: string;
}

const isPostgrestError = (err: unknown): err is PostgrestLikeError =>
  typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string';

const POSTGRES_STATUS_BY_CODE: Record<string, number> = {
  '23505': 409, // unique_violation
  '23503': 400, // foreign_key_violation
  '23502': 400, // not_null_violation
  PGRST116: 404, // no rows found for .single()
};

const resolveError = (err: unknown): { statusCode: number; message: string } => {
  if (err instanceof HttpError) {
    return { statusCode: err.statusCode, message: err.message };
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message;
    return { statusCode: 400, message };
  }
  if (isPostgrestError(err)) {
    return { statusCode: (err.code && POSTGRES_STATUS_BY_CODE[err.code]) || 500, message: err.message };
  }
  if (err instanceof Error) {
    return { statusCode: 500, message: err.message };
  }
  return { statusCode: 500, message: 'Internal server error' };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const { statusCode, message } = resolveError(err);

  logger.error(message, { path: req.originalUrl, method: req.method, statusCode });

  res.status(statusCode).json({
    message: statusCode === 500 && env.isProduction ? 'Internal server error' : message,
  });
};
