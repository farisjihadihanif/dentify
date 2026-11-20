import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(issue.message);
  }
  return result;
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new ApiError(
          422,
          'VALIDATION_ERROR',
          'Data yang dikirim tidak valid.',
          formatZodErrors(parsed.error),
        ),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(
  schema: T,
  options?: { statusCode?: 400 | 422 },
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      if (options?.statusCode === 400) {
        const firstMsg = parsed.error.issues[0]?.message ?? 'Parameter permintaan tidak valid.';
        next(new ApiError(400, 'BAD_REQUEST', firstMsg));
        return;
      }
      next(
        new ApiError(
          422,
          'VALIDATION_ERROR',
          'Parameter permintaan tidak valid.',
          formatZodErrors(parsed.error),
        ),
      );
      return;
    }
    (req as Request & { validatedQuery?: unknown }).validatedQuery = parsed.data;
    next();
  };
}
