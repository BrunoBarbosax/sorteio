import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import Logo from '../../components/Logo';

interface LoginPageProps {
  onSuccess: () => void;
}

/** Tela de acesso restrito do painel administrativo. */
export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await api('api/auth/login', { method: 'POST', body: { email: email.trim(), password } });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-center">
      <div className="card card-gold adm-login-card">
        <div className="text-center mb-2">
          <Logo size={64} animate />
        </div>
        <p className="eyebrow text-center">ACESSO RESTRITO</p>
        <h1 className="title-gold text-center" style={{ fontSize: '1.5rem' }}>
          Painel administrativo
        </h1>
        <p className="card-sub text-center">Entre com as suas credenciais para gerenciar os sorteios.</p>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label className="label" htmlFor="adm-login-email">
              E-mail
            </label>
            <input
              id="adm-login-email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="admin@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="adm-login-password">
              Senha
            </label>
            <input
              id="adm-login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <div className="alert alert-error mb-2" role="alert" aria-live="assertive">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn btn-gold btn-lg" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
