import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { api, ApiError, downloadCsv } from '../../lib/api';
import type { Paged, Participant } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';

type SortField = 'name' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type StatusFilter = '' | 'active' | 'removed';

interface Filters {
  q: string;
  status: StatusFilter;
  sort: SortField;
  order: SortOrder;
  page: number;
}

const PAGE_SIZE = 20;

/** Gestão de participantes: busca, filtros, edição, remoção e exportação. */
export default function ParticipantsPage() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({ q: '', status: '', sort: 'createdAt', order: 'desc', page: 1 });
  const [data, setData] = useState<Paged<Participant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editar
  const [editing, setEditing] = useState<Participant | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'removed'>('active');
  const [saving, setSaving] = useState(false);

  // Remover
  const [removing, setRemoving] = useState<Participant | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce da busca (350ms)
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
      const result = await api<Paged<Participant>>('api/admin/participants', {
        query: {
          q: current.q,
          status: current.status,
          sort: current.sort,
          order: current.order,
          page: current.page,
          pageSize: PAGE_SIZE,
        },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os participantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const toggleSort = (field: SortField) => {
    setFilters((current) => ({
      ...current,
      sort: field,
      order: current.sort === field && current.order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const sortIcon = (field: SortField): string => {
    if (filters.sort !== field) return '';
    return filters.order === 'asc' ? '▲' : '▼';
  };

  const openEdit = (participant: Participant) => {
    setEditing(participant);
    setEditName(participant.name);
    setEditStatus(participant.status);
  };

  const saveEdit = async () => {
    if (!editing || saving) return;
    const name = editName.trim();
    if (name.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api(`api/admin/participants/${editing.id}`, { method: 'PATCH', body: { name, status: editStatus } });
      toast.success('Participante atualizado.');
      setEditing(null);
      void load(filters);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing || deleting) return;
    setDeleting(true);
    try {
      await api(`api/admin/participants/${removing.id}`, { method: 'DELETE' });
      toast.success('Participante removido.');
      setRemoving(null);
      void load(filters);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover o participante.');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as StatusFilter;
    setFilters((current) => ({ ...current, status: value, page: 1 }));
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <p className="eyebrow">BASE DE PARTICIPANTES</p>
          <h1 className="title-gold">Participantes</h1>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => downloadCsv('api/admin/participants/export.csv', 'participantes-gorjeta77.csv')}
        >
          Exportar CSV
        </button>
      </div>

      <div className="card">
        <div className="adm-filters">
          <div className="field" style={{ marginBottom: 0, flex: 2, minWidth: 220 }}>
            <label className="label" htmlFor="adm-participants-search">
              Buscar por nome ou ID
            </label>
            <input
              id="adm-participants-search"
              className="input"
              type="search"
              placeholder="Digite para buscar…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 170 }}>
            <label className="label" htmlFor="adm-participants-status">
              Status
            </label>
            <select id="adm-participants-status" className="select" value={filters.status} onChange={handleStatusFilter}>
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="removed">Removidos</option>
            </select>
          </div>
        </div>

        <div className="row mt-2">
          <span className="badge">Total: {data ? data.total : '—'}</span>
          {filters.q ? <span className="badge badge-gold">Busca: “{filters.q}”</span> : null}
          {filters.status ? (
            <span className="badge badge-gold">{filters.status === 'active' ? 'Ativos' : 'Removidos'}</span>
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
          <p className="text-muted mt-2">Carregando participantes…</p>
        </div>
      ) : !error && data && data.items.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">Nenhum participante encontrado.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" className="adm-th-btn" onClick={() => toggleSort('name')}>
                      Nome <span aria-hidden="true">{sortIcon('name')}</span>
                    </button>
                  </th>
                  <th scope="col">ID</th>
                  <th scope="col">
                    <button type="button" className="adm-th-btn" onClick={() => toggleSort('createdAt')}>
                      Cadastro <span aria-hidden="true">{sortIcon('createdAt')}</span>
                    </button>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((participant) => (
                  <tr key={participant.id}>
                    <td>{participant.name}</td>
                    <td className="mono">{participant.externalId}</td>
                    <td>{formatDate(participant.createdAtIso)}</td>
                    <td>
                      {participant.status === 'active' ? (
                        <span className="badge badge-green">Ativo</span>
                      ) : (
                        <span className="badge badge-red">Removido</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(participant)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setRemoving(participant)}>
                          Remover
                        </button>
                      </div>
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

      <Modal open={editing !== null} title="Editar participante" onClose={() => setEditing(null)}>
        <div className="field">
          <span className="label">ID</span>
          <p className="mono" style={{ margin: 0 }}>
            {editing?.externalId}
          </p>
        </div>
        <div className="field">
          <label className="label" htmlFor="adm-participant-name">
            Nome
          </label>
          <input
            id="adm-participant-name"
            className="input"
            type="text"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="adm-participant-edit-status">
            Status
          </label>
          <select
            id="adm-participant-edit-status"
            className="select"
            value={editStatus}
            onChange={(event) => setEditStatus(event.target.value as 'active' | 'removed')}
          >
            <option value="active">Ativo</option>
            <option value="removed">Removido</option>
          </select>
        </div>
        <div className="row">
          <button type="button" className="btn btn-gold" onClick={() => void saveEdit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={removing !== null} title="Remover participante" onClose={() => setRemoving(null)}>
        <div className="alert alert-error mb-2">
          ATENÇÃO: esta ação não pode ser desfeita. O participante será excluído da base e deixará de participar dos
          próximos sorteios.
        </div>
        <p>
          Você está prestes a remover <strong>{removing?.name}</strong> (ID <span className="mono">{removing?.externalId}</span>).
        </p>
        <div className="row">
          <button type="button" className="btn btn-danger" onClick={() => void confirmRemove()} disabled={deleting}>
            {deleting ? 'Removendo…' : 'Sim, remover'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
