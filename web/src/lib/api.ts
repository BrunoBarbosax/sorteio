/* Cliente HTTP da API Gorjeta 77 Lukas.
   - gerencia token CSRF (double submit cookie)
   - traduz erros em mensagens compreensiveis
   - envia cookies de sessao (same-origin) */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfPromise: Promise<string | null> | null = null;

/** Obtem o token CSRF; se necessario, consulta a sessao para emitir o cookie. */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie('gj_csrf');
  if (existing) return existing;
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && typeof data.csrfToken === 'string' ? data.csrfToken : null))
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function resolveUrl(path: string): URL {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, window.location.origin);
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const url = resolveUrl(path);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = await ensureCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Nao foi possivel conectar ao servidor. Verifique sua conexao.');
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload as { message?: string }).message) ||
      'Ocorreu um erro inesperado. Tente novamente.';
    const code = (payload && typeof payload === 'object' && (payload as { error?: string }).error) || 'error';
    const details = payload && typeof payload === 'object' ? (payload as { details?: unknown }).details : undefined;
    throw new ApiError(response.status, message, code, details);
  }

  return payload as T;
}

/** Monta a URL absoluta de um resultado publico. */
export function publicDrawUrl(slug: string): string {
  return `${window.location.origin}/sorteio/${slug}`;
}

/** Dispara o download de um arquivo CSV autenticado. */
export function downloadCsv(path: string, filename: string): void {
  const url = resolveUrl(path);
  fetch(url.toString(), { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('Falha ao exportar.');
      return res.blob();
    })
    .then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    })
    .catch(() => {
      alert('Nao foi possivel exportar o arquivo. Tente novamente.');
    });
}
