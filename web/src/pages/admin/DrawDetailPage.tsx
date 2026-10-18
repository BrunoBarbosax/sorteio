import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, publicDrawUrl } from '../../lib/api';
import type { Draw } from '../../lib/types';
import { STYLE_LABELS, formatDate, formatDuration } from '../../lib/format';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import DrawShow from '../../components/DrawShow';

interface DrawResponse {
  draw: Draw;
}

interface DrawExecuteResponse {
  ok: boolean;
  executed: boolean;
  draw: Draw;
}

/** Detalhe de um sorteio: configuração, execução, ganhadores e apresentação. */
export default function DrawDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showDraw, setShowDraw] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await api<DrawResponse>(`api/admin/draws/${id}`);
      setDraw(response.draw);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o sorteio.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const executeNow = async () => {
    if (!draw || executing) return;
    setExecuting(true);
    try {
      const response = await api<DrawExecuteResponse>(`api/admin/draws/${draw.id}/execute`, { method: 'POST' });
      toast.success('Sorteio executado com sucesso!');
      setDraw(response.draw);
      setConfirmOpen(false);
      setShowDraw(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível executar o sorteio.');
    } finally {
      setExecuting(false);
    }
  };

  const watchPresentation = async () => {
    if (!draw) return;
    try {
      const response = await api<DrawResponse>(`api/admin/draws/${draw.id}`);
      setDraw(response.draw);
      setShowDraw(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar a apresentação.');
    }
  };

  const copyPublicLink = async () => {
    if (!draw) return;
    try {
      await navigator.clipboard.writeText(publicDrawUrl(draw.slug));
      toast.success('Link público copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  if (loading) {
    return (
      <div className="adm-center adm-block" role="status" aria-live="polite">
        <span className="spinner spinner-lg" />
        <p className="text-muted mt-2">Carregando sorteio…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="card text-center">
        <h1 className="card-title">Sorteio não encontrado</h1>
        <p className="card-sub">O sorteio solicitado não existe ou foi removido.</p>
        <button type="button" className="btn btn-gold" onClick={() => navigate('/admin/sorteios')}>
          Voltar ao histórico
        </button>
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

  if (!draw) return null;

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <p className="eyebrow">DETALHE DO SORTEIO</p>
          <h1 className="title-gold">{draw.name}</h1>
          <div className="row mt-1">
            {draw.status === 'completed' ? (
              <span className="badge badge-gold">Concluído</span>
            ) : (
              <span className="badge badge-blue">Pendente</span>
            )}
            <span className="adm-chip">Estilo: {STYLE_LABELS[draw.style] ?? draw.style}</span>
            <span className="adm-chip">Animação: {formatDuration(draw.durationSeconds)}</span>
            <span className="adm-chip">Som: {draw.soundEnabled ? 'Ativado' : 'Desativado'}</span>
            <span className="adm-chip">{draw.publicResults ? 'Resultado público' : 'Resultado privado'}</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/sorteios')}>
          Voltar
        </button>
      </div>

      <div className="card">
        <div className="adm-detail-grid">
          <div>
            <span className="adm-detail-label">Criado em</span>
            <span className="adm-detail-value">{formatDate(draw.createdAtIso)}</span>
          </div>
          <div>
            <span className="adm-detail-label">Executado em</span>
            <span className="adm-detail-value">{draw.executedAt ? formatDate(draw.executedAt) : '—'}</span>
          </div>
          <div>
            <span className="adm-detail-label">Elegíveis</span>
            <span className="adm-detail-value">{draw.eligibleCount ?? '—'}</span>
          </div>
          <div>
            <span className="adm-detail-label">Administrador</span>
            <span className="adm-detail-value">{draw.adminName ?? '—'}</span>
          </div>
        </div>
        {draw.description ? <p className="text-muted mt-2">{draw.description}</p> : null}
      </div>

      {draw.status === 'pending' ? (
        <section className="card card-gold">
          <h2 className="card-title">Executar sorteio</h2>
          <p className="card-sub">
            Este sorteio ainda não foi executado. Ao confirmar, os ganhadores serão sorteados entre os{' '}
            {draw.eligibleCount ?? 0} participantes elegíveis.
          </p>
          <button type="button" className="btn btn-gold btn-lg" onClick={() => setConfirmOpen(true)}>
            Executar sorteio agora
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="row-between mb-2">
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              Ganhadores ({draw.winners.length})
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-gold" onClick={() => void watchPresentation()}>
                Assistir apresentação
              </button>
              {draw.publicResults ? (
                <>
                  <button type="button" className="btn" onClick={() => void copyPublicLink()}>
                    Copiar link público
                  </button>
                  <a className="btn btn-ghost" href={`/sorteio/${draw.slug}`} target="_blank" rel="noreferrer">
                    Abrir resultado público
                  </a>
                </>
              ) : null}
            </div>
          </div>
          <ul className="adm-winner-list">
            {draw.winners.map((winner) => (
              <li key={winner.id ?? `${winner.position}-${winner.externalId ?? winner.name}`} className="adm-winner">
                <span className="adm-winner-pos">{winner.position}º</span>
                <span className="adm-winner-name">{winner.name}</span>
                {winner.externalId ? <span className="mono text-muted">{winner.externalId}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={confirmOpen} title="Confirmar execução" onClose={() => setConfirmOpen(false)}>
        <div className="alert alert-info mb-2">
          O resultado é definido no instante da execução e será gravado antes da animação. Esta ação não pode ser
          desfeita.
        </div>
        <p>
          Sorteio: <strong>{draw.name}</strong>
          <br />
          Ganhadores: {draw.winnerCount} · Elegíveis: {draw.eligibleCount ?? '—'}
        </p>
        <div className="row">
          <button type="button" className="btn btn-gold" onClick={() => void executeNow()} disabled={executing}>
            {executing ? 'Executando…' : 'Confirmar e executar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>

      {showDraw ? <DrawShow draw={draw} onExit={() => setShowDraw(false)} /> : null}
    </div>
  );
}
