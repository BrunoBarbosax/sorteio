import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from './errors';

/** Empacota handlers async para propagar erros ao middleware de erro. */
export function handler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Valida dados com Zod e lanca erro 400 legivel quando invalidos. */
export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    }));
    const message = issues[0]?.message ?? 'Dados invalidos.';
    throw badRequest(message, { issues });
  }
  return result.data;
}

/** Normaliza espacos e acentuacao para buscas simples. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapa o caractere curinga do LIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function boolFromDb(value: unknown): boolean {
  return value === 1 || value === '1' || value === true;
}
