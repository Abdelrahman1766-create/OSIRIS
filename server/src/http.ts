import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodTypeAny } from 'zod';
import multer from 'multer';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_ERROR') {
    super(message);
  }
}

export function validate<T extends ZodTypeAny>(schema: T, value: unknown) {
  return schema.parse(value) as ReturnType<T['parse']>;
}

export function parseId(value: string | string[] | undefined): string {
  if (!value || Array.isArray(value)) throw new HttpError(400, 'Invalid identifier');
  return value;
}

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'Route not found', 'NOT_FOUND'));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res, _next) => {
  void _next;
  if (error instanceof ZodError) {
    res.status(422).json({ code: 'VALIDATION_ERROR', message: 'Invalid request', issues: error.flatten() });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ code: error.code, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ code: 'CONFLICT', message: 'A record with this value already exists' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Record not found' });
      return;
    }
    if (error.code === 'P2034') {
      res.status(409).json({ code: 'ORDER_CONFLICT', message: 'The order changed. Please try again' });
      return;
    }
  }
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({ code: 'UPLOAD_ERROR', message: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ code: 'INVALID_JSON', message: 'Malformed JSON request' });
    return;
  }
  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
};
