import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminUser, SessionResponse } from '../../lib/types';
import Logo from '../../components/Logo';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import ParticipantsPage from './ParticipantsPage';
import CreateDrawPage from './CreateDrawPage';
import HistoryPage from './HistoryPage';
import DrawDetailPage from './DrawDetailPage';
import AuditPage from './AuditPage';
import '../../styles/admin.css';

interface SessionState {
  loading: boolean;
  admin: AdminUser | null;
}

interface TabItem {
  to: string;
  label: string;
  end: boolean;
}

const TABS: TabItem[] = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/participantes', label: 'Participantes', end: false },
  { to: '/admin/sorteios/novo', label: 'Criar sorteio', end: true },
  { to: '/admin/sorteios', label: 'Histórico', end: false },
  { to: '/admin/auditoria', label: 'Auditoria', end: false },
];

/** Roteador do painel administrativo com guarda de sessão e layout propio. */
export default function AdminApp() {
  const [session, setSession] = useState<SessionState>({ loading: true, admin: null });

  const loadSession = useCallback(async () => {
    setSession({ loading: true, admin: null });
    try {
      const data = await api<SessionResponse>('api/auth/session');
      setSession({ loading: false, admin: data.authenticated ? data.admin : null });
    } catch {
      setSession({ loading: false, admin: null });
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleLogout = async () => {
    try {
      await api('api/auth/logout', { method: 'POST' });
    } catch {
      // Mesmo com falha na API, a sessão local é encerrada abaixo.
    }
    setSession({ loading: false, admin: null });
  };

  if (session.loading) {
    return (
      <div className="adm-center" role="status" aria-live="polite">
        <span className="spinner spinner-lg" />
        <p className="text-muted mt-2">Carregando painel…</p>
      </div>
    );
  }

  if (!session.admin) {
    return <LoginPage onSuccess={() => void loadSession()} />;
  }

  const admin = session.admin;

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-inner">
          <div className="adm-brand">
            <Logo size={34} />
            <span className="adm-brand-text">
              GORJETA 77 LUKAS <span className="adm-brand-sep">·</span> <span className="adm-brand-sub">Painel</span>
            </span>
          </div>
          <div className="adm-user">
            <div className="adm-user-info">
              <span className="adm-user-name">{admin.name}</span>
              <span className="adm-user-email">{admin.email}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleLogout()}>
              Sair
            </button>
          </div>
        </div>
        <nav className="adm-tabs" aria-label="Navegação do painel">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isActive ? 'adm-tab adm-tab-active' : 'adm-tab')}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="adm-content">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="participantes" element={<ParticipantsPage />} />
          <Route path="sorteios/novo" element={<CreateDrawPage />} />
          <Route path="sorteios" element={<HistoryPage />} />
          <Route path="sorteios/:id" element={<DrawDetailPage />} />
          <Route path="auditoria" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
