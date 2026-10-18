export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Sessao invalida ou expirada.') =>
  new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'Acesso negado.') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Registro nao encontrado.') =>
  new HttpError(404, message, 'not_found');
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, message, 'conflict', details);
export const tooMany = (message = 'Muitas requisicoes. Aguarde um instante e tente novamente.') =>
  new HttpError(429, message, 'rate_limited');
export const internal = (message = 'Erro interno do servidor.') =>
  new HttpError(500, message, 'internal_error');
