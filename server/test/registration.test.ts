import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, registerParticipant, type TestContext } from './helpers';

describe('Cadastro publico de participantes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('cadastra um participante valido e confirma o registro', async () => {
    const res = await registerParticipant(ctx.app, 'Maria da Silva', 'ABC123');
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.participant.name).toBe('Maria da Silva');
    expect(res.body.participant.externalId).toBe('ABC123');
    expect(res.body.participant.status).toBe('active');

    const stored = await ctx.db.get<{ name: string; external_id: string }>(
      'SELECT name, external_id FROM participants WHERE external_id = ?',
      ['ABC123'],
    );
    expect(stored?.name).toBe('Maria da Silva');
  });

  it('bloqueia ID duplicado (mesmo com diferenca de maiusculas)', async () => {
    const first = await registerParticipant(ctx.app, 'Joao Souza', 'dup-001');
    expect(first.status).toBe(201);
    const second = await registerParticipant(ctx.app, 'Outra Pessoa', 'DUP-001');
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/ja esta cadastrado/i);
  });

  it('rejeita campos obrigatorios e valores vazios', async () => {
    const empty = await request(ctx.app).post('/api/public/participants').send({});
    expect(empty.status).toBe(400);

    const blankName = await request(ctx.app)
      .post('/api/public/participants')
      .send({ name: '   ', externalId: 'XYZ1' });
    expect(blankName.status).toBe(400);

    const blankId = await request(ctx.app)
      .post('/api/public/participants')
      .send({ name: 'Ana Clara', externalId: '' });
    expect(blankId.status).toBe(400);
  });

  it('rejeita nomes e IDs com formato invalido', async () => {
    const badName = await request(ctx.app)
      .post('/api/public/participants')
      .send({ name: '123456', externalId: 'OK-1' });
    expect(badName.status).toBe(400);

    const badId = await request(ctx.app)
      .post('/api/public/participants')
      .send({ name: 'Pedro Alves', externalId: 'id com espaco!' });
    expect(badId.status).toBe(400);

    const longId = await request(ctx.app)
      .post('/api/public/participants')
      .send({ name: 'Pedro Alves', externalId: 'X'.repeat(60) });
    expect(longId.status).toBe(400);
  });

  it('permite consultar o status do proprio cadastro sem expor a lista', async () => {
    await registerParticipant(ctx.app, 'Carla Dias', 'CONS-9');
    const found = await request(ctx.app).get('/api/public/participants/status?externalId=CONS-9');
    expect(found.status).toBe(200);
    expect(found.body.found).toBe(true);
    expect(found.body.participant.name).toBe('Carla Dias');

    const missing = await request(ctx.app).get('/api/public/participants/status?externalId=NAO-EXISTE');
    expect(missing.status).toBe(404);

    // A listagem completa nao esta disponivel publicamente.
    const list = await request(ctx.app).get('/api/public/participants');
    expect(list.status).toBe(404);
  });

  it('os cadastros permanecem apos reiniciar o banco (persistencia)', async () => {
    const filePath = './test/tmp-persistence.db';
    const fs = await import('node:fs');
    if (fs.existsSync(filePath)) fs.rmSync(filePath);

    const first = await createTestContext(filePath);
    await registerParticipant(first.app, 'Persistente Um', 'PERSIST-1');
    await first.db.close();

    const second = await createTestContext(filePath);
    const row = await second.db.get<{ name: string }>(
      'SELECT name FROM participants WHERE external_id = ?',
      ['PERSIST-1'],
    );
    expect(row?.name).toBe('Persistente Um');
    await second.db.close();
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  });
});
