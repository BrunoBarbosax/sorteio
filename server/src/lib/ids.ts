import { randomBytes, randomInt } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Gera um identificador publico curto, nao previsivel e sem ambiguidade. */
export function newId(size = 18): string {
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/** Token opaco de sessao (o banco guarda apenas o hash SHA-256). */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function plusHoursIso(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 3600 * 1000).toISOString();
}
