import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { AuditItem } from '../../lib/types';
import { formatDate } from '../../lib/format';

interface AuditResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface Filters {
  action: string;
  page: number;
}

const PAGE_SIZE = 30;

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas as ações' },
  { value: 'auth.login', label: 'auth.login' },
  { value: 'auth.login_failed', label: 'auth.login_failed' },
  { value: 'participant.update', label: 'participant.update' },
  { value: 'participant.remove', label: 'participant.remove' },
  { value: 'draw.create', label: 'draw.create' },
  { value: 'draw.execute', label: 'draw.execute' },
];

/** Trilha de auditoria do painel com filtro por ação e paginação. */
export default function AuditPage() {
  const [filters, setFilters] = useState<Filters>({ action: '', page: 1 });
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (current: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<AuditResponse>('api/auth/audit', {
        query: { action: current.action, page: current.page, pageSize: PAGE_SIZE },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const formatDetails = (details: string | null): string => {
    if (!details) return '';
    try {
      const parsed: unknown = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  };

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">TRILHA DE AUDITORIA</p>
        <h1 className="title-gold">Auditoria</h1>
      </div>

      <div className="card">
        <div className="field" style={{ marginBottom: 0, maxWidth: 340 }}>
          <label className="label" htmlFor="adm-audit-action">
            Filtrar por ação
          </label>
          <select
            id="adm-audit-action"
            className="select"
            value={filters.action}
            onChange={(event) => setFilters({ action: event.target.value, page: 1 })}
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row mt-2">
          <span className="badge">Total: {data ? data.total : '—'}</span>
          <span className="badge badge-blue">
            Página {filters.page} de {totalPages}
          </span>
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
          <p className="text-muted mt-2">Carregando auditoria…</p>
        </div>
      ) : !error && data && data.items.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">Nenhum registro de auditoria encontrado.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Administrador</th>
                  <th scope="col">Entidade</th>
                  <th scope="col">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <span className={badgeClassFor(item.action)}>{item.action}</span>
                    </td>
                    <td>{item.admin_email ?? '—'}</td>
                    <td>
                      {item.entity ?? '—'}
                      {item.entity_id ? (
                        <>
                          <br />
                          <span className="mono text-muted" style={{ fontSize: '0.8rem' }}>
                            {item.entity_id}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {item.details ? (
                        <details>
                          <summary>Ver</summary>
                          <pre className="adm-json">{formatDetails(item.details)}</pre>
                        </details>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-between">
            <span className="text-muted">
              Página {filters.page} de {totalPages} · {data ? data.total : 0} registro(s)
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

/** Classe de badge conforme o tipo de ação registrada. */
function badgeClassFor(action: string): string {
  if (action.endsWith('_failed')) return 'badge badge-red';
  if (action.startsWith('draw.execute')) return 'badge badge-gold';
  if (action.startsWith('draw.create')) return 'badge badge-blue';
  if (action.startsWith('participant.remove')) return 'badge badge-red';
  if (action.startsWith('participant')) return 'badge badge-green';
  return 'badge';
}
