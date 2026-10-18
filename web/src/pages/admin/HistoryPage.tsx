import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, downloadCsv } from '../../lib/api';
import type { Draw, Paged } from '../../lib/types';
import { formatDate, formatDuration } from '../../lib/format';
import { useToast } from '../../components/Toast';

interface DrawExecuteResponse {
  ok: boolean;
  executed: boolean;
  draw: Draw;
}

interface Filters {
  q: string;
  from: string;
  to: string;
  page: number;
}

const PAGE_SIZE = 15;

/** Histórico de sorteios com busca, filtros de período, execução e exportação. */
export default function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState<Filters>({ q: '', from: '', to: '', page: 1 });
  const [data, setData] = useState<Paged<Draw> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Debounce da busca por nome (350ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => {
        const q = search.trim();
        if (current.q === q) return current;
        return { ...current, q, page: 1 };
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (current: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Paged<Draw>>('api/admin/draws', {
        query: {
          q: current.q,
          from: current.from,
          to: current.to,
          page: current.page,
          pageSize: PAGE_SIZE,
        },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const applyPeriod = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setFilters((current) => ({ ...current, from: nextFrom, to: nextTo, page: 1 }));
  };

  const executeDraw = async (draw: Draw) => {
    if (executingId) return;
    const confirmed = window.confirm(
      `Executar o sorteio "${draw.name}" agora? O resultado será definido e gravado neste instante.`,
    );
    if (!confirmed) return;
    setExecutingId(draw.id);
    try {
      const response = await api<DrawExecuteResponse>(`api/admin/draws/${draw.id}/execute`, { method: 'POST' });
      toast.success('Sorteio executado com sucesso!');
      navigate(`/admin/sorteios/${response.draw.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível executar o sorteio.');
      setExecutingId(null);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <p className="eyebrow">ARQUIVO DE SORTEIOS</p>
          <h1 className="title-gold">Histórico</h1>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => downloadCsv('api/admin/draws/export.csv', 'historico-sorteios-gorjeta77.csv')}
        >
          Exportar CSV
        </button>
      </div>

      <div className="card">
        <div className="adm-filters">
          <div className="field" style={{ marginBottom: 0, flex: 2, minWidth: 220 }}>
            <label className="label" htmlFor="adm-draws-search">
              Buscar por nome
            </label>
            <input
              id="adm-draws-search"
              className="input"
              type="search"
              placeholder="Nome do sorteio…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
            <label className="label" htmlFor="adm-draws-from">
              De
            </label>
            <input
              id="adm-draws-from"
              className="input"
              type="date"
              value={from}
              onChange={(event) => applyPeriod(event.target.value, to)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
            <label className="label" htmlFor="adm-draws-to">
              Até
            </label>
            <input
              id="adm-draws-to"
              className="input"
              type="date"
              value={to}
              onChange={(event) => applyPeriod(from, event.target.value)}
            />
          </div>
        </div>
        <div className="row mt-2">
          <span className="badge">Total: {data ? data.total : '—'}</span>
          <span className="badge badge-blue">
            Página {filters.page} de {totalPages}
          </span>
          {from || to ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => applyPeriod('', '')}>
              Limpar período
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="adm-center adm-block" role="status" aria-live="polite">
          <span className="spinner spinner-lg" />
          <p className="text-muted mt-2">Carregando sorteios…</p>
        </div>
      ) : !error && data && data.items.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">Nenhum sorteio encontrado.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Sorteio</th>
                  <th scope="col">Data</th>
                  <th scope="col">Ganhadores</th>
                  <th scope="col">Elegíveis</th>
                  <th scope="col">Duração</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((draw) => {
                  const extra = draw.winners.length - 2;
                  return (
                    <tr key={draw.id}>
                      <td>
                        <strong>{draw.name}</strong>
                        <br />
                        <span className="mono text-muted" style={{ fontSize: '0.8rem' }}>
                          {draw.slug}
                        </span>
                      </td>
                      <td>{formatDate(draw.executedAt ?? draw.createdAtIso)}</td>
                      <td>
                        <span className="badge badge-gold">{draw.winners.length}</span>{' '}
                        {draw.winners.length > 0 ? (
                          <span className="text-muted">
                            {draw.winners
                              .slice(0, 2)
                              .map((winner) => winner.name)
                              .join(', ')}
                            {extra > 0 ? ` +${extra}` : ''}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{draw.eligibleCount ?? '—'}</td>
                      <td>{formatDuration(draw.durationSeconds)}</td>
                      <td>
                        {draw.status === 'completed' ? (
                          <span className="badge badge-gold">Concluído</span>
                        ) : (
                          <span className="badge badge-blue">Pendente</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => navigate(`/admin/sorteios/${draw.id}`)}
                          >
                            Ver detalhes
                          </button>
                          {draw.status === 'pending' ? (
                            <button
                              type="button"
                              className="btn btn-gold btn-sm"
                              disabled={executingId !== null}
                              onClick={() => void executeDraw(draw)}
                            >
                              {executingId === draw.id ? 'Executando…' : 'Executar'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row-between">
            <span className="text-muted">
              Página {filters.page} de {totalPages} · {data ? data.total : 0} sorteio(s)
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                ‹ Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Próximo ›
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
