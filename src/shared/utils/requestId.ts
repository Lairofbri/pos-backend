import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export type RequestStore = {
  requestId: string;
  method: string;
  path: string;
  ip: string;
};

const als = new AsyncLocalStorage<RequestStore>();

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
  (req as unknown as Record<string, unknown>).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  als.run({ requestId, method: req.method, path: req.path, ip: req.ip ?? '' }, () => next());
}

export function getStore(): RequestStore | undefined {
  return als.getStore();
}
