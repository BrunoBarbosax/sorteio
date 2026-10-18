import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { env } from '../env';

/** Tratamento centralizado de erros: resposta previsivel, log sem vazamentos. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const known = err instanceof HttpError;

  if (!known) {
    // Erro inesperado: registra no servidor sem expor detalhes ao cliente.
    console.error('[erro]', req.method, req.originalUrl, err instanceof Error ? err.stack : err);
  }

  const status = known ? err.status : 500;
  const payload: Record<string, unknown> = {
    error: known ? err.code : 'internal_error',
    message: known ? err.message : 'Erro interno do servidor. Tente novamente.',
  };
  if (known && err.details !== undefined) payload.details = err.details;
  if (!env.isProduction && !known && err instanceof Error) payload.debug = err.message;

  res.status(status).json(payload);
}

/** Resposta 404 para rotas de API desconhecidas. */
export function notFoundHandler(req: Request, res: Response): void {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'not_found', message: 'Rota nao encontrada.' });
    return;
  }
  res.status(404).send('Nao encontrado');
}
