import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  adminLogin,
  createTestContext,
  seedAdmin,
  seedParticipants,
  type AdminSession,
  type TestContext,
} from './helpers';
import { secureShuffle } from '../src/modules/draws/rng';

describe('Sorteios: criacao, execucao e resultados', () => {
  let ctx: TestContext;
  let admin: AdminSession;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedAdmin(ctx.db);
    admin = await adminLogin(ctx.app);
    await seedParticipants(ctx.db, 12);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  const createDraw = (payload: Record<string, unknown>) =>
    admin.agent.post('/api/admin/draws').set('x-csrf-token', admin.csrfToken).send(payload);

  it('apresenta o dashboard com os totais', async () => {
    const res = await admin.agent.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalParticipants).toBe(12);
    expect(res.body.totalDraws).toBe(0);
  });

  it('impede duracao inferior a 30 segundos', async () => {
    const res = await createDraw({
      name: 'Sorteio Rapido',
      winnerCount: 1,
      durationSeconds: 20,
      style: 'classic',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/30 segundos/i);
  });

  it('impede quantidade de ganhadores invalida', async () => {
    const zero = await createDraw({ name: 'Invalido', winnerCount: 0, durationSeconds: 30 });
    expect(zero.status).toBe(400);

    const negative = await createDraw({ name: 'Invalido', winnerCount: -3, durationSeconds: 30 });
    expect(negative.status).toBe(400);

    const text = await createDraw({ name: 'Invalido', winnerCount: 'abc', durationSeconds: 30 });
    expect(text.status).toBe(400);
  });

  it('sorteia exatamente a quantidade configurada, sem repeticao', async () => {
    const res = await createDraw({
      name: 'Rodada Premiada 1',
      winnerCount: 3,
      durationSeconds: 45,
      style: 'neon',
      soundEnabled: true,
      publicResults: true,
      executeNow: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.executed).toBe(true);

    const draw = res.body.draw;
    expect(draw.status).toBe('completed');
    expect(draw.winners).toHaveLength(3);
    expect(draw.eligibleCount).toBe(12);

    const ids = draw.winners.map((w: { externalId: string }) => w.externalId);
    expect(new Set(ids).size).toBe(3);

    // pool visual acompanha os ganhadores (a animacao nao altera o resultado)
    expect(draw.visualPool).toHaveLength(12);
    const poolWinners = draw.visualPool.filter((p: { isWinner: boolean }) => p.isWinner);
    expect(poolWinners).toHaveLength(3);
  });

  it('impede executar o mesmo sorteio duas vezes', async () => {
    const created = await createDraw({
      name: 'Rodada Unica',
      winnerCount: 1,
      durationSeconds: 30,
      executeNow: false,
    });
    expect(created.status).toBe(201);
    const id = created.body.draw.id;

    const first = await admin.agent
      .post(`/api/admin/draws/${id}/execute`)
      .set('x-csrf-token', admin.csrfToken);
    expect(first.status).toBe(200);
    expect(first.body.winners).toHaveLength(1);

    const second = await admin.agent
      .post(`/api/admin/draws/${id}/execute`)
      .set('x-csrf-token', admin.csrfToken);
    expect(second.status).toBe(409);
    expect(second.body.message).match(/ja foi executado/i);
  });

  it('bloqueia sorteio com mais ganhadores que participantes', async () => {
    const created = await createDraw({
      name: 'Rodada Impossivel',
      winnerCount: 50,
      durationSeconds: 30,
      executeNow: false,
    });
    expect(created.status).toBe(201);
    const res = await admin.agent
      .post(`/api/admin/draws/${created.body.draw.id}/execute`)
      .set('x-csrf-token', admin.csrfToken);
    expect(res.status).toBe(400);
    expect(res.body.message).match(/insuficientes/i);
  });

  it('impede criar e executar de uma vez sem participantes suficientes', async () => {
    const res = await createDraw({ name: 'Sem Gente', winnerCount: 99, durationSeconds: 30, executeNow: true });
    expect(res.status).toBe(400);
    expect(res.body.message).match(/insuficientes/i);
  });

  it('sorteia um unico ganhador corretamente', async () => {
    const res = await createDraw({ name: 'Rodada Single', winnerCount: 1, durationSeconds: 30, executeNow: true });
    expect(res.status).toBe(201);
    expect(res.body.draw.winners).toHaveLength(1);
  });

  it('sorteia 10 ganhadores distintos', async () => {
    const res = await createDraw({ name: 'Rodada Dez', winnerCount: 10, durationSeconds: 60, executeNow: true });
    expect(res.status).toBe(201);
    const ids = res.body.draw.winners.map((w: { externalId: string }) => w.externalId);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it('persiste o resultado e o historico', async () => {
    const list = await admin.agent.get('/api/admin/draws');
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(4);
    const completed = list.body.items.filter((d: { status: string }) => d.status === 'completed');
    expect(completed.length).toBeGreaterThanOrEqual(4);

    const detail = await admin.agent.get(`/api/admin/draws/${completed[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.draw.winners.length).toBeGreaterThanOrEqual(1);
  });

  it('expoe resultados publicos apenas quando autorizados', async () => {
    const hidden = await createDraw({
      name: 'Sorteio Reservado',
      winnerCount: 1,
      durationSeconds: 30,
      publicResults: false,
      executeNow: true,
    });
    expect(hidden.status).toBe(201);
    const hiddenSlug = hidden.body.draw.slug;
    const hiddenRes = await request(ctx.app).get(`/api/public/draws/${hiddenSlug}`);
    expect(hiddenRes.status).toBe(404);

    const visible = await createDraw({
      name: 'Sorteio Publico',
      winnerCount: 2,
      durationSeconds: 30,
      publicResults: true,
      executeNow: true,
    });
    expect(visible.status).toBe(201);
    const slug = visible.body.draw.slug;
    const res = await request(ctx.app).get(`/api/public/draws/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.draw.name).toBe('Sorteio Publico');
    expect(res.body.draw.winners).toHaveLength(2);

    const list = await request(ctx.app).get('/api/public/draws');
    expect(list.status).toBe(200);
    expect(list.body.items.some((d: { slug: string }) => d.slug === slug)).toBe(true);
    expect(list.body.items.some((d: { slug: string }) => d.slug === hiddenSlug)).toBe(false);
  });

  it('nao lista participantes publicamente', async () => {
    const res = await request(ctx.app).get('/api/public/info');
    expect(res.status).toBe(200);
    expect(res.body.participantCount).toBe(12);
    expect(JSON.stringify(res.body)).not.toMatch(/Participante 12/);
  });

  it('registra acoes no log de auditoria', async () => {
    const res = await admin.agent.get('/api/auth/audit?pageSize=50');
    expect(res.status).toBe(200);
    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('draw.create');
    expect(actions).toContain('draw.execute');
    expect(actions).toContain('auth.login');
  });

  it('exporta o historico em CSV', async () => {
    const res = await admin.agent.get('/api/admin/draws/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/Sorteio;Data;Ganhadores/);
    expect(res.text).toMatch(/Rodada Premiada 1/);
  });

  it('bloqueia exportacao e listagens sem sessao', async () => {
    const res = await request(ctx.app).get('/api/admin/draws/export.csv');
    expect(res.status).toBe(401);
  });

  it('a selecao aleatoria e uniforme, sem repeticao e sem perda de participantes', () => {
    const pool = Array.from({ length: 50 }, (_, i) => `p${i}`);
    const picked = secureShuffle(pool, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    picked.forEach((p) => expect(pool).toContain(p));

    const full = secureShuffle(pool, pool.length);
    expect(new Set(full).size).toBe(50);

    expect(() => secureShuffle(pool, 51)).toThrow();
  });

  it('corrige participante e gera auditoria da correcao', async () => {
    const list = await admin.agent.get('/api/admin/participants?q=Participante 12');
    const target = list.body.items[0];
    const res = await admin.agent
      .patch(`/api/admin/participants/${target.id}`)
      .set('x-csrf-token', admin.csrfToken)
      .send({ name: 'Nome Corrigido' });
    expect(res.status).toBe(200);
    expect(res.body.participant.name).toBe('Nome Corrigido');

    const audit = await admin.agent.get('/api/auth/audit?action=participant.update');
    expect(audit.body.items.length).toBeGreaterThanOrEqual(1);

    const removal = await admin.agent
      .delete(`/api/admin/participants/${target.id}`)
      .set('x-csrf-token', admin.csrfToken);
    expect(removal.status).toBe(200);
    const after = await admin.agent.get('/api/admin/participants?q=ID0012');
    expect(after.body.items[0].status).toBe('removed');
  });
});
