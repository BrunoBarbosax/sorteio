import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, publicDrawUrl } from '../lib/api';
import type { Draw, DrawWinner } from '../lib/types';
import { formatDate, formatNumber } from '../lib/format';
import SiteHeader from '../components/SiteHeader';
import Logo from '../components/Logo';
import Particles from '../components/Particles';
import { useToast } from '../components/Toast';
import '../styles/public.css';

interface ConfettiPiece {
  key: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}

const CONFETTI_COLORS = ['#ff2d3f', '#ffd9dd', '#ff7043', '#ffffff', '#8b0f1a'];

function winnerLabel(count: number): string {
  return count === 1 ? '1 ganhador' : `${count} ganhadores`;
}

/** Página pública de resultado do sorteio (/sorteio/:slug). */
export default function PublicDrawPage() {
  const { slug } = useParams<{ slug: string }>();
  const toast = useToast();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    setError(null);
    api<{ draw: Draw }>(`api/public/draws/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((data) => {
        if (!cancelled) setDraw(data.draw);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setNotFound(true);
        } else {
          setError(
            caught instanceof ApiError ? caught.message : 'Não foi possível carregar o resultado. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug, reloadNonce]);

  useEffect(() => {
    document.title = draw ? `${draw.name} | Gorjeta 77 Lukas` : 'Resultado do sorteio | Gorjeta 77 Lukas';
  }, [draw]);

  const confetti = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        key: index,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 6 + Math.random() * 7,
        size: 6 + Math.random() * 7,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );

  const winners = draw ? [...draw.winners].sort((a, b) => a.position - b.position) : [];

  async function handleCopyLink(): Promise<void> {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(publicDrawUrl(slug));
      toast.success('Link do resultado copiado!');
    } catch {
      toast.error('Não foi possível copiar o link. Copie-o da barra de endereço do navegador.');
    }
  }

  return (
    <div className="result-page">
      <div className="result-bg" aria-hidden="true">
        <Particles intensity={0.9} />
        <div className="result-rays" />
        <div className="result-confetti">
          {confetti.map((piece) => (
            <span
              key={piece.key}
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.6,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      </div>

      <SiteHeader />

      <main className="page result-content">
        <div className="container stack">
          {loading && (
            <div className="text-center" role="status">
              <span className="spinner spinner-lg" aria-hidden="true" />
              <p className="text-muted mt-2">Carregando resultado oficial…</p>
            </div>
          )}

          {!loading && notFound && (
            <div className="card result-notfound">
              <h2 className="card-title">Resultado não encontrado ou ainda não divulgado</h2>
              <p className="card-sub">
                O link pode estar incorreto ou o sorteio ainda está sendo preparado. Fique atento:
                novos resultados são publicados por aqui.
              </p>
              <Link to="/" className="btn btn-gold">
                Ir para a página inicial
              </Link>
            </div>
          )}

          {!loading && !notFound && error && (
            <div className="card result-notfound" role="alert">
              <h2 className="card-title">Não foi possível exibir o resultado</h2>
              <p className="card-sub">{error}</p>
              <div className="row home-center">
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setReloadNonce((current) => current + 1)}
                >
                  Tentar novamente
                </button>
                <Link to="/" className="btn btn-ghost">
                  Ir para a página inicial
                </Link>
              </div>
            </div>
          )}

          {!loading && !notFound && !error && draw && (
            <>
              <section className="result-hero animate-up">
                <Logo size={96} animate />
                <p className="eyebrow">RESULTADO OFICIAL</p>
                <h1 className="title-gold">{draw.name}</h1>
                <div className="result-meta">
                  <span className="badge badge-blue">
                    {formatDate(draw.executedAt || draw.createdAtIso)}
                  </span>
                  <span className="badge badge-gold">{winnerLabel(draw.winnerCount)}</span>
                  {draw.eligibleCount !== null && (
                    <span className="badge">{formatNumber(draw.eligibleCount)} participantes no sorteio</span>
                  )}
                </div>
              </section>

              {winners.length > 0 ? (
                <div className="grid-3 result-grid">
                  {winners.map((winner: DrawWinner) => (
                    <article
                      key={winner.id ?? `${winner.position}-${winner.name}`}
                      className={`card result-winner${winner.position === 1 ? ' result-winner-first' : ''}`}
                    >
                      <span className="result-winner-pos">{winner.position}º</span>
                      <p className="result-winner-name">{winner.name}</p>
                      {winner.externalId && <p className="result-winner-id mono">ID: {winner.externalId}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center mt-3">
                  Este sorteio ainda não possui ganhadores publicados.
                </p>
              )}

              <div className="row result-actions">
                <Link to="/" className="btn btn-gold btn-lg">
                  Participar do próximo sorteio
                </Link>
                <button type="button" className="btn btn-ghost" onClick={handleCopyLink}>
                  Copiar link do resultado
                </button>
              </div>
            </>
          )}
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
