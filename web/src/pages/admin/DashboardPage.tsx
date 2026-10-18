import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { AdminStats, Draw } from '../../lib/types';
import { formatDate, formatNumber } from '../../lib/format';
import { useToast } from '../../components/Toast';

interface DrawExecuteResponse {
  ok: boolean;
  executed: boolean;
  draw: Draw;
}

/** Visão geral do painel: métricas, último sorteio e sorteio pendente. */
export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AdminStats>('api/admin/stats');
      setStats(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const executePending = async () => {
    if (!stats?.pendingDraw || executing) return;
    const confirmed = window.confirm(
      `Executar o sorteio "${stats.pendingDraw.name}" agora? O resultado será definido e gravado neste instante.`,
    );
    if (!confirmed) return;
    setExecuting(true);
    try {
      const response = await api<DrawExecuteResponse>(`api/admin/draws/${stats.pendingDraw.id}/execute`, {
        method: 'POST',
      });
      toast.success('Sorteio executado com sucesso!');
      navigate(`/admin/sorteios/${response.draw.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível executar o sorteio.');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="adm-center adm-block" role="status" aria-live="polite">
        <span className="spinner spinner-lg" />
        <p className="text-muted mt-2">Carregando métricas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <div className="alert alert-error" role="alert">
          {error}
        </div>
        <div>
          <button type="button" className="btn" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const activeParticipants = Math.max(0, stats.totalParticipants - stats.removedParticipants);
  const lastDraw = stats.lastDraw;

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1 className="title-gold">Dashboard</h1>
        </div>
        <div className="row">
          <button type="button" className="btn btn-gold" onClick={() => navigate('/admin/sorteios/novo')}>
            Criar sorteio
          </button>
          <button type="button" className="btn" onClick={() => navigate('/admin/participantes')}>
            Participantes
          </button>
        </div>
      </div>

      <div className="adm-metrics">
        <div className="card adm-metric">
          <span className="adm-metric-value">{formatNumber(activeParticipants)}</span>
          <span className="adm-metric-label">Participantes ativos</span>
        </div>
        <div className="card adm-metric">
          <span className="adm-metric-value">{formatNumber(stats.completedDraws)}</span>
          <span className="adm-metric-label">Sorteios realizados</span>
        </div>
        <div className="card adm-metric">
          <span className="adm-metric-value">{formatNumber(stats.totalWinners)}</span>
          <span className="adm-metric-label">Ganhadores registrados</span>
        </div>
        <div className="card adm-metric">
          <span className="adm-metric-value">{formatNumber(stats.removedParticipants)}</span>
          <span className="adm-metric-label">Cadastros removidos</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Último sorteio</h2>
          {lastDraw ? (
            <>
              <p className="card-sub">
                {lastDraw.name} · {formatDate(lastDraw.executedAt ?? lastDraw.createdAtIso)}
              </p>
              <div className="row mb-2">
                {lastDraw.winners.length > 0 ? (
                  lastDraw.winners.map((winner) => (
                    <span key={winner.id ?? `${winner.position}-${winner.externalId ?? winner.name}`} className="badge badge-gold">
                      {winner.position}º {winner.name}
                    </span>
                  ))
                ) : (
                  <span className="badge">Sem ganhadores registrados</span>
                )}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/admin/sorteios/${lastDraw.id}`)}
                >
                  Ver detalhes
                </button>
                {lastDraw.winners.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-gold"
                    onClick={() => navigate(`/admin/sorteios/${lastDraw.id}`)}
                  >
                    Assistir apresentação
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-muted">Nenhum sorteio realizado até o momento.</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Sorteio pendente</h2>
          {stats.pendingDraw ? (
            <>
              <div className="alert alert-info mb-2">
                <strong>{stats.pendingDraw.name}</strong> está pronto para ser executado. O resultado é definido no
                instante da execução e gravado antes da animação.
              </div>
              <p className="card-sub">
                {stats.pendingDraw.winnerCount} ganhador(es) · animação de {stats.pendingDraw.durationSeconds}s ·
                inscritos: {formatNumber(stats.pendingDraw.eligibleCount ?? 0)}
              </p>
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => void executePending()}
                disabled={executing}
              >
                {executing ? 'Executando…' : 'Executar agora'}
              </button>
            </>
          ) : (
            <p className="text-muted">Nenhum sorteio pendente.</p>
          )}
        </section>
      </div>
    </div>
  );
}
