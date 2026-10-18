import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Draw, DrawCreatePayload, DrawStyle } from '../../lib/types';
import { STYLE_LABELS } from '../../lib/format';
import { useToast } from '../../components/Toast';

interface DrawCreateResponse {
  ok: boolean;
  executed: boolean;
  draw: Draw;
}

interface FormErrors {
  name?: string;
  winnerCount?: string;
  durationSeconds?: string;
}

const WINNER_SHORTCUTS = [1, 2, 3, 5, 10];
const DURATION_SHORTCUTS = [30, 45, 60, 90, 120];
const STYLE_OPTIONS: DrawStyle[] = ['classic', 'neon', 'gala'];

/** Formulário de criação de sorteio com resumo ao vivo das configurações. */
export default function CreateDrawPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [durationSeconds, setDurationSeconds] = useState('60');
  const [style, setStyle] = useState<DrawStyle>('classic');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [publicResults, setPublicResults] = useState(true);
  const [publicShowIds, setPublicShowIds] = useState(true);
  const [executeNow, setExecuteNow] = useState(true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      next.name = 'Informe um nome entre 2 e 80 caracteres.';
    }
    const winners = Number(winnerCount);
    if (!Number.isInteger(winners) || winners < 1 || winners > 1000) {
      next.winnerCount = 'Informe um número inteiro entre 1 e 1000.';
    }
    const duration = Number(durationSeconds);
    if (!Number.isInteger(duration) || duration < 30 || duration > 3600) {
      next.durationSeconds = 'Informe um número inteiro de segundos entre 30 e 3600.';
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setApiError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: DrawCreatePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      winnerCount: Number(winnerCount),
      durationSeconds: Number(durationSeconds),
      style,
      soundEnabled,
      publicResults,
      publicShowIds: publicShowIds && publicResults,
      executeNow,
    };

    setSubmitting(true);
    try {
      const response = await api<DrawCreateResponse>('api/admin/draws', { method: 'POST', body: payload });
      toast.success(response.executed ? 'Sorteio criado e executado com sucesso!' : 'Sorteio criado com sucesso!');
      navigate(`/admin/sorteios/${response.draw.id}`);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Não foi possível criar o sorteio.');
      setSubmitting(false);
    }
  };

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">NOVO SORTEIO</p>
        <h1 className="title-gold">Criar sorteio</h1>
      </div>

      {apiError ? (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {apiError}
        </div>
      ) : null}

      <div className="grid-2">
        <form className="card" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <h2 className="card-title">Configuração</h2>
          <p className="card-sub">Defina o nome, a quantidade de ganhadores e a apresentação do sorteio.</p>

          <div className="field">
            <label className="label" htmlFor="adm-draw-name">
              Nome do sorteio *
            </label>
            <input
              id="adm-draw-name"
              className="input"
              type="text"
              maxLength={80}
              placeholder="Ex.: Sorteio de Outubro"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'adm-draw-name-error' : undefined}
            />
            {errors.name ? (
              <span id="adm-draw-name-error" className="error-text" role="alert">
                {errors.name}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label className="label" htmlFor="adm-draw-description">
              Descrição (opcional)
            </label>
            <textarea
              id="adm-draw-description"
              className="textarea"
              rows={3}
              placeholder="Observações internas sobre este sorteio…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="adm-draw-winners">
              Quantidade de ganhadores *
            </label>
            <input
              id="adm-draw-winners"
              className="input"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={winnerCount}
              onChange={(event) => setWinnerCount(event.target.value)}
              aria-invalid={errors.winnerCount ? true : undefined}
              aria-describedby={errors.winnerCount ? 'adm-draw-winners-error' : undefined}
            />
            <span className="hint">Digite qualquer quantidade inteira — ex.: 1, 2, 3, 10 ou 50</span>
            {errors.winnerCount ? (
              <span id="adm-draw-winners-error" className="error-text" role="alert">
                {errors.winnerCount}
              </span>
            ) : null}
            <div className="adm-quick">
              {WINNER_SHORTCUTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setWinnerCount(String(value))}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="adm-draw-duration">
              Duração da animação (segundos) *
            </label>
            <input
              id="adm-draw-duration"
              className="input"
              type="number"
              min={30}
              max={3600}
              step={1}
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(event.target.value)}
              aria-invalid={errors.durationSeconds ? true : undefined}
              aria-describedby={errors.durationSeconds ? 'adm-draw-duration-error' : undefined}
            />
            <span className="hint">Mínimo de 30 segundos</span>
            {errors.durationSeconds ? (
              <span id="adm-draw-duration-error" className="error-text" role="alert">
                {errors.durationSeconds}
              </span>
            ) : null}
            <div className="adm-quick">
              {DURATION_SHORTCUTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setDurationSeconds(String(value))}
                >
                  {value}s
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="adm-draw-style">
              Estilo visual
            </label>
            <select id="adm-draw-style" className="select" value={style} onChange={(event) => setStyle(event.target.value as DrawStyle)}>
              {STYLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {STYLE_LABELS[option] ?? option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Opções</span>
            <label className="adm-check">
              <input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} />
              <span>Habilitar efeitos sonoros</span>
            </label>
            <label className="adm-check">
              <input
                type="checkbox"
                checked={publicResults}
                onChange={(event) => setPublicResults(event.target.checked)}
              />
              <span>Exibir resultados publicamente</span>
            </label>
            <label className={publicResults ? 'adm-check' : 'adm-check adm-check-disabled'}>
              <input
                type="checkbox"
                checked={publicShowIds && publicResults}
                disabled={!publicResults}
                onChange={(event) => setPublicShowIds(event.target.checked)}
              />
              <span>Mostrar ID dos ganhadores no resultado público</span>
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={executeNow} onChange={(event) => setExecuteNow(event.target.checked)} />
              <span>Executar o sorteio imediatamente após criar</span>
            </label>
          </div>

          {executeNow ? (
            <div className="alert alert-info mb-2" role="status">
              O resultado é definido no instante da execução e será gravado antes da animação.
            </div>
          ) : null}

          <div className="row">
            <button type="submit" className="btn btn-gold btn-lg" disabled={submitting}>
              {submitting ? 'Criando…' : executeNow ? 'Criar e executar' : 'Criar sorteio'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/sorteios')}>
              Cancelar
            </button>
          </div>
        </form>

        <aside className="card card-gold" aria-live="polite">
          <h2 className="card-title">Resumo</h2>
          <p className="card-sub">Prévia de como o sorteio será configurado.</p>
          <ul className="adm-summary">
            <li>
              <span className="adm-summary-label">Nome</span>
              <span className="adm-summary-value">{name.trim() || '—'}</span>
            </li>
            <li>
              <span className="adm-summary-label">Ganhadores</span>
              <span className="adm-summary-value">
                {winnerCount || '0'} ganhador{Number(winnerCount) === 1 ? '' : 'es'}
              </span>
            </li>
            <li>
              <span className="adm-summary-label">Animação</span>
              <span className="adm-summary-value">animação de {durationSeconds || '0'}s</span>
            </li>
            <li>
              <span className="adm-summary-label">Estilo</span>
              <span className="adm-summary-value">{STYLE_LABELS[style] ?? style}</span>
            </li>
            <li>
              <span className="adm-summary-label">Som</span>
              <span className="adm-summary-value">{soundEnabled ? 'Ativado' : 'Desativado'}</span>
            </li>
            <li>
              <span className="adm-summary-label">Visibilidade</span>
              <span className="adm-summary-value">{publicResults ? 'Público' : 'Privado'}</span>
            </li>
            <li>
              <span className="adm-summary-label">Execução</span>
              <span className="adm-summary-value">{executeNow ? 'Imediata' : 'Manual (depois)'}</span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
