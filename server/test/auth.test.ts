import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminLogin, createTestContext, seedAdmin, type TestContext } from './helpers';

describe('Autenticacao e protecao do painel administrativo', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedAdmin(ctx.db);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('bloqueia rotas administrativas sem sessao', async () => {
    const res = await request(ctx.app).get('/api/admin/participants');
    expect(res.status).toBe(401);

    const draw = await request(ctx.app).get('/api/admin/draws');
    expect(draw.status).toBe(401);

    const stats = await request(ctx.app).get('/api/auth/audit');
    expect(stats.status).toBe(401);
  });

  it('rejeita senha incorreta e nao vaza credenciais', async () => {
    const agent = request.agent(ctx.app);
    const session = await agent.get('/api/auth/session');
    const res = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', String(session.body.csrfToken))
      .send({ email: 'admin@teste.com', password: 'senha-errada' });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|\$2[aby]\$/);
  });

  it('realiza login com credenciais validas e entrega sessao protegida', async () => {
    const { agent } = await adminLogin(ctx.app);
    const session = await agent.get('/api/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(true);
    expect(session.body.admin.email).toBe('admin@teste.com');

    const participants = await agent.get('/api/admin/participants');
    expect(participants.status).toBe(200);
  });

  it('exige token CSRF em requisicoes administrativas que alteram dados', async () => {
    const { agent } = await adminLogin(ctx.app);
    const res = await agent.post('/api/admin/draws').send({ name: 'Sem CSRF' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/seguranca/i);
  });

  it('bloqueia origem cross-site', async () => {
    const { agent, csrfToken } = await adminLogin(ctx.app);
    const res = await agent
      .post('/api/admin/draws')
      .set('Origin', 'https://site-malicioso.com')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Ataque CSRF' });
    expect(res.status).toBe(403);
  });

  it('encerra a sessao no logout', async () => {
    const { agent, csrfToken } = await adminLogin(ctx.app);
    const out = await agent.post('/api/auth/logout').set('x-csrf-token', csrfToken);
    expect(out.status).toBe(200);
    const session = await agent.get('/api/auth/session');
    expect(session.body.authenticated).toBe(false);
    const blocked = await agent.get('/api/admin/participants');
    expect(blocked.status).toBe(401);
  });
});
