import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wraps an async route handler so a thrown/rejected error reaches Express's error handler. */
export function ah(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
