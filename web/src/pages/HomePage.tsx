import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Draw, DrawWinner, PublicInfo, PublicParticipant, RegisterResponse, StatusResponse } from '../lib/types';
import { formatDate, formatNumber } from '../lib/format';
import SiteHeader from '../components/SiteHeader';
import Logo from '../components/Logo';
import Particles from '../components/Particles';
import { useToast } from '../components/Toast';
import '../styles/public.css';

/* Validações espelhando o backend. */
const NAME_RE = /^[\p{L}][\p{L}\s'.-]{1,79}$/u;
const ID_RE = /^[A-Za-z0-9._-]{3,40}$/;

/* Resumo do último resultado exibido na home (o tipo do backend não é exportado). */
interface LastResultSummary {
  name: string;
  slug: string;
  executedAt: string | null;
  createdAtIso: string;
  winnerCount: number;
  winners: DrawWinner[] | null;
}

function toLastResult(source: PublicInfo['lastResult']): LastResultSummary | null {
  if (!source) return null;
  return {
    name: source.name,
    slug: source.slug,
    executedAt: source.executedAt,
    createdAtIso: source.createdAtIso,
    winnerCount: source.winnerCount,
    winners: source.winners ?? null,
  };
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function winnerLabel(count: number): string {
  return count === 1 ? '1 ganhador' : `${count} ganhadores`;
}

/** Página inicial: hero, cadastro, consulta de status e resultados. */
export default function HomePage() {
  const toast = useToast();

  /* informações gerais (api/public/info) */
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [lastResult, setLastResult] = useState<LastResultSummary | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  /* resultados anteriores */
  const [draws, setDraws] = useState<Draw[]>([]);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [drawsError, setDrawsError] = useState<string | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  /* formulário de cadastro */
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RegisterResponse | null>(null);

  /* consulta de status */
  const [lookupId, setLookupId] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [statusResult, setStatusResult] = useState<PublicParticipant | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Gorjeta 77 Lukas | Cadastre-se e participe';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInfoLoading(true);
    api<PublicInfo>('api/public/info')
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setLastResult(toLastResult(data.lastResult));
        setInfoError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setInfoError(toMessage(error, 'Não foi possível carregar as informações do sorteio.'));
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    setDrawsLoading(true);
    api<Draw[] | { items: Draw[] }>('api/public/draws', { query: { limit: 6 } })
      .then((data) => {
        if (cancelled) return;
        setDraws(Array.isArray(data) ? data : data.items);
        setDrawsError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDrawsError(toMessage(error, 'Não foi possível carregar os resultados.'));
      })
      .finally(() => {
        if (!cancelled) setDrawsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  function handleRegister(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedId = externalId.trim();

    const nextNameError = NAME_RE.test(trimmedName)
      ? null
      : 'Informe um nome válido com 2 a 80 caracteres (letras, espaços, apóstrofos, pontos e hífens).';
    const nextIdError = ID_RE.test(trimmedId)
      ? null
      : 'O ID deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.';
    setNameError(nextNameError);
    setIdError(nextIdError);
    if (nextNameError || nextIdError) return;

    setSubmitting(true);
    setRegisterError(null);
    api<RegisterResponse>('api/public/participants', {
      method: 'POST',
      body: { name: trimmedName, externalId: trimmedId },
    })
      .then((response) => {
        setRegistered(response);
        toast.success('Cadastro confirmado! Você já está participando.');
        setInfo((current) =>
          current ? { ...current, participantCount: current.participantCount + 1 } : current,
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError && error.status === 409
            ? `${error.message} Escolha outro ID ou consulte o status do cadastro ao lado.`
            : toMessage(error, 'Não foi possível concluir o cadastro. Tente novamente.');
        setRegisterError(message);
        toast.error(message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function handleResetRegister(): void {
    setRegistered(null);
    setRegisterError(null);
    setNameError(null);
    setIdError(null);
    setName('');
    setExternalId('');
  }

  function handleStatus(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedId = lookupId.trim();
    if (!ID_RE.test(trimmedId)) {
      setLookupError('Informe um ID válido (3 a 40 caracteres).');
      return;
    }
    setLookupError(null);
    setLookupPending(true);
    setStatusResult(null);
    setStatusMessage(null);
    api<StatusResponse>('api/public/participants/status', { query: { externalId: trimmedId } })
      .then((response) => {
        if (response.found && response.participant) {
          setStatusResult(response.participant);
        } else {
          setStatusMessage(response.message || 'Nenhum cadastro encontrado com esse ID.');
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setStatusMessage(error.message);
        } else {
          setStatusMessage(toMessage(error, 'Não foi possível consultar o cadastro agora. Tente novamente.'));
        }
      })
      .finally(() => {
        setLookupPending(false);
      });
  }

  const lastWinners = lastResult ? (lastResult.winners ?? []).slice(0, 3) : [];
  const lastWinnersLeft = lastResult ? Math.max(0, lastResult.winnerCount - lastWinners.length) : 0;

  return (
    <div className="home-shell">
      <Particles density={1} intensity={0.7} />
      <SiteHeader />

      <main className="page home-main">
        <div className="container">
          {/* ---------------------------- HERO ---------------------------- */}
          <section className="home-hero animate-up">
            <Logo size={110} animate />
            <p className="eyebrow">SORTEIOS OFICIAIS</p>
            <h1 className="title-gold">GORJETA 77 LUKAS</h1>
            <p className="home-hero-copy">
              Cadastre-se em segundos e concorra automaticamente em todos os sorteios oficiais.
              Sem taxas, sem burocracia e com total transparência do início ao resultado.
            </p>
            <div className="home-badges">
              <a href="#cadastro" className="btn btn-gold btn-lg">
                Quero participar
              </a>
              {infoLoading ? (
                <span className="badge">carregando…</span>
              ) : info ? (
                <span className="badge badge-gold">
                  {formatNumber(info.participantCount)} participantes cadastrados
                </span>
              ) : null}
            </div>
          </section>

          {/* ------------------------ COMO PARTICIPAR ----------------------- */}
          <section className="home-section">
            <div className="home-section-head text-center">
              <p className="eyebrow">PASSO A PASSO</p>
              <h2>Como participar</h2>
              <p className="text-muted">Três passos simples e você já está concorrendo.</p>
            </div>
            <div className="grid-3">
              <article className="card home-step animate-up">
                <span className="home-step-num">1</span>
                <h3>Preencha seu nome e ID</h3>
                <p>Informe seu nome completo e escolha um identificador (ID) fácil de lembrar.</p>
              </article>
              <article className="card home-step animate-up">
                <span className="home-step-num">2</span>
                <h3>Confirme o cadastro</h3>
                <p>Revise os dados e confirme. Pronto, seu cadastro fica registrado na hora.</p>
              </article>
              <article className="card home-step animate-up">
                <span className="home-step-num">3</span>
                <h3>Aguarde o sorteio</h3>
                <p>Todo participante válido entra automaticamente no sorteio. É só torcer!</p>
              </article>
            </div>
          </section>

          {/* --------------------------- CADASTRO --------------------------- */}
          <section id="cadastro" className="home-section">
            <div className="home-section-head text-center">
              <p className="eyebrow">PARTICIPE AGORA</p>
              <h2>Garanta sua vaga</h2>
              <p className="text-muted">Leva menos de um minuto. Depois, é só acompanhar o resultado.</p>
            </div>

            <div className="grid-2">
              {/* card: formulário de cadastro */}
              <div className="card card-gold">
                <h3 className="card-title">Cadastro</h3>
                <p className="card-sub">Preencha os dados abaixo e confirme para entrar nos próximos sorteios.</p>

                {registered ? (
                  <div className="alert alert-success" role="status" aria-live="polite">
                    <strong>{registered.message || 'Cadastro confirmado!'}</strong>
                    <p className="mt-1">
                      Nome: <strong>{registered.participant.name}</strong>
                    </p>
                    <p>
                      ID: <span className="mono">{registered.participant.externalId}</span>
                    </p>
                    <p>Cadastrado em: {formatDate(registered.participant.registeredAt)}</p>
                    <button type="button" className="btn btn-ghost mt-2" onClick={handleResetRegister}>
                      Fazer outro cadastro
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} noValidate>
                    {registerError && (
                      <div className="alert alert-error" role="alert" aria-live="assertive">
                        {registerError}
                      </div>
                    )}

                    <div className="field">
                      <label className="label" htmlFor="reg-name">
                        Nome completo
                      </label>
                      <input
                        id="reg-name"
                        className="input"
                        type="text"
                        autoComplete="name"
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-invalid={nameError ? 'true' : 'false'}
                      />
                      {nameError && <span className="error-text">{nameError}</span>}
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="reg-id">
                        ID do participante
                      </label>
                      <input
                        id="reg-id"
                        className="input mono"
                        type="text"
                        placeholder="Ex.: 12345"
                        value={externalId}
                        onChange={(event) => setExternalId(event.target.value)}
                        aria-invalid={idError ? 'true' : 'false'}
                      />
                      <span className="hint">
                        Letras, números, ponto, hífen ou sublinhado (3 a 40 caracteres)
                      </span>
                      {idError && <span className="error-text">{idError}</span>}
                    </div>

                    <button type="submit" className="btn btn-gold" disabled={submitting}>
                      {submitting ? (
                        <>
                          <span className="spinner" aria-hidden="true" /> Enviando...
                        </>
                      ) : (
                        'Confirmar cadastro'
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* card: consulta de status */}
              <div className="card home-status">
                <h3 className="card-title">Consultar meu cadastro</h3>
                <p className="card-sub">Informe o ID usado no cadastro para verificar se ele está ativo.</p>

                <form onSubmit={handleStatus} noValidate>
                  <div className="field">
                    <label className="label" htmlFor="status-id">
                      ID do participante
                    </label>
                    <input
                      id="status-id"
                      className="input mono"
                      type="text"
                      placeholder="Ex.: 12345"
                      value={lookupId}
                      onChange={(event) => setLookupId(event.target.value)}
                      aria-invalid={lookupError ? 'true' : 'false'}
                    />
                    {lookupError && <span className="error-text">{lookupError}</span>}
                  </div>
                  <button type="submit" className="btn" disabled={lookupPending}>
                    {lookupPending ? 'Consultando...' : 'Consultar status'}
                  </button>
                </form>

                <div className="stack mt-2" aria-live="polite">
                  {statusResult && (
                    <div className="home-status-card">
                      <p className="mb-2">
                        <strong>{statusResult.name}</strong>
                      </p>
                      <p className="mono text-muted">ID: {statusResult.externalId}</p>
                      {statusResult.status === 'active' ? (
                        <span className="badge badge-green mt-1">Ativo nos sorteios</span>
                      ) : (
                        <span className="badge badge-red mt-1">Cadastro removido — contate a organização</span>
                      )}
                    </div>
                  )}
                  {statusMessage && <div className="alert alert-info">{statusMessage}</div>}
                </div>
              </div>
            </div>
          </section>

          {/* --------------------- INFORMAÇÕES DO SORTEIO ------------------- */}
          <section className="home-section">
            <div className="home-section-head text-center">
              <p className="eyebrow">TRANSPARÊNCIA</p>
              <h2>Informações do sorteio</h2>
            </div>

            {infoLoading && (
              <div className="text-center" role="status">
                <span className="spinner" aria-hidden="true" />
                <p className="text-muted mt-1">Carregando informações…</p>
              </div>
            )}

            {infoError && (
              <div className="alert alert-error" role="alert">
                <p>{infoError}</p>
                <button
                  type="button"
                  className="btn btn-sm mt-1"
                  onClick={() => setReloadNonce((current) => current + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {info && (
              <div className="stack">
                {info.pendingDraws > 0 && (
                  <div className="alert alert-info">Próximo sorteio em preparação — fique atento!</div>
                )}

                {lastResult ? (
                  <div className="card card-gold">
                    <div className="row-between">
                      <div>
                        <p className="eyebrow">ÚLTIMO RESULTADO</p>
                        <h3 className="card-title">{lastResult.name}</h3>
                        <p className="text-muted">
                          Realizado em {formatDate(lastResult.executedAt || lastResult.createdAtIso)}
                        </p>
                      </div>
                      <span className="badge badge-gold">{winnerLabel(lastResult.winnerCount)}</span>
                    </div>

                    {lastWinners.length > 0 && (
                      <ul className="home-winner-list">
                        {lastWinners.map((winner) => (
                          <li key={winner.id ?? `${winner.position}-${winner.name}`}>{winner.name}</li>
                        ))}
                        {lastWinnersLeft > 0 && (
                          <li className="text-muted">
                            e outros {lastWinnersLeft} {lastWinnersLeft === 1 ? 'ganhador' : 'ganhadores'}
                          </li>
                        )}
                      </ul>
                    )}

                    <Link to={`/sorteio/${lastResult.slug}`} className="btn btn-gold mt-3">
                      Ver resultado completo
                    </Link>
                  </div>
                ) : (
                  <div className="alert alert-info">O primeiro sorteio estará em breve. Cadastre-se!</div>
                )}
              </div>
            )}
          </section>

          {/* ---------------------- RESULTADOS ANTERIORES ------------------- */}
          <section id="resultados" className="home-section">
            <div className="home-section-head text-center">
              <p className="eyebrow">HISTÓRICO</p>
              <h2>Resultados anteriores</h2>
            </div>

            {drawsLoading && (
              <div className="text-center" role="status">
                <span className="spinner" aria-hidden="true" />
                <p className="text-muted mt-1">Carregando resultados…</p>
              </div>
            )}

            {drawsError && (
              <div className="alert alert-error" role="alert">
                <p>{drawsError}</p>
                <button
                  type="button"
                  className="btn btn-sm mt-1"
                  onClick={() => setReloadNonce((current) => current + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!drawsLoading && !drawsError && draws.length === 0 && (
              <p className="text-muted text-center">Nenhum resultado publicado ainda.</p>
            )}

            {draws.length > 0 && (
              <div className="grid-3">
                {draws.map((draw) => {
                  const winners = draw.winners ?? [];
                  const topWinners = winners.slice(0, 3);
                  const extra = winners.length - topWinners.length;
                  return (
                    <article key={draw.id} className="card home-result-card">
                      <h3 className="home-result-name">{draw.name}</h3>
                      <p className="text-muted">{formatDate(draw.executedAt || draw.createdAtIso)}</p>
                      <span className="badge badge-gold">{winnerLabel(draw.winnerCount)}</span>
                      <ul className="home-winner-list">
                        {topWinners.map((winner) => (
                          <li key={winner.id ?? `${winner.position}-${winner.name}`}>{winner.name}</li>
                        ))}
                        {extra > 0 && <li className="text-muted">e outros</li>}
                      </ul>
                      <Link to={`/sorteio/${draw.slug}`} className="btn btn-sm mt-1">
                        Ver resultado
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer home-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} Gorjeta 77 Lukas — Sorteios oficiais.</p>
          <p className="mt-1">
            <Link to="/privacidade">Política de Privacidade</Link>
            {' · '}
            <Link to="/admin">Área restrita</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
