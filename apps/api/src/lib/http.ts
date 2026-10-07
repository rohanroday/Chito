import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';

/** Thrown anywhere in a handler; rendered as { error: { code, message } }. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new HttpError(400, code, message, details);
export const unauthorized = (message = 'Please log in again') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Not allowed') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details);

/** Parse req.body / req.query with a Zod schema, throwing a 400 on failure. */
export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('VALIDATION', 'Some details are missing or invalid', z.flattenError(r.error).fieldErrors);
  return r.data;
}

/** Errors from libraries that are really the caller's fault, so they get a clear 4xx instead of a 500. */
function knownError(err: unknown): HttpError | null {
  const e = err as { type?: string; name?: string; code?: number; kind?: string };
  // express.json(): broken JSON / body too big
  if (e?.type === 'entity.parse.failed') return badRequest('BAD_JSON', 'The request was not valid JSON');
  if (e?.type === 'entity.too.large') return new HttpError(413, 'TOO_LARGE', 'That is too much data to send at once');
  // Mongoose: an id that isn't an ObjectId ("/orders/abc") simply doesn't exist
  if (e?.name === 'CastError' && e.kind === 'ObjectId') return notFound();
  // Unique index (e.g. the same order sent twice at once)
  if (e?.code === 11000) return conflict('DUPLICATE', 'That already exists');
  return null;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const known = err instanceof HttpError ? err : knownError(err);
  if (known) {
    res.status(known.status).json({ error: { code: known.code, message: known.message, details: known.details } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } });
}
