import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit, clearRateLimits } from '../src/middleware/rateLimit';
import { env } from '../src/env';

// O ambiente de teste desativa a limitacao globalmente; aqui reativamos
// para validar o comportamento do middleware em si.
env.rateLimitDisabled = false;

function fakeReq(ip = '10.0.0.1'): Request {
  return { ip, socket: { remoteAddress: ip }, method: 'POST', get: () => undefined } as unknown as Request;
}

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  } as unknown as Response;
}

describe('Limitacao de requisicoes (anti-spam)', () => {
  it('bloqueia alem do maximo permitido na janela', () => {
    clearRateLimits();
    const mw = rateLimit({ name: 'teste', windowMs: 60_000, max: 3 });
    const errors: unknown[] = [];
    const next = (err?: unknown) => {
      if (err) errors.push(err);
    };

    for (let i = 0; i < 3; i += 1) mw(fakeReq(), fakeRes(), next as NextFunction);
    expect(errors).toHaveLength(0);

    mw(fakeReq(), fakeRes(), next as NextFunction);
    expect(errors).toHaveLength(1);
  });

  it('chaves diferentes nao compartilham o contador', () => {
    clearRateLimits();
    const mw = rateLimit({ name: 'teste2', windowMs: 60_000, max: 1 });
    const errors: unknown[] = [];
    const next = (err?: unknown) => {
      if (err) errors.push(err);
    };
    mw(fakeReq('1.1.1.1'), fakeRes(), next as NextFunction);
    mw(fakeReq('2.2.2.2'), fakeRes(), next as NextFunction);
    expect(errors).toHaveLength(0);
  });
});
