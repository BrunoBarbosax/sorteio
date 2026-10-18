/** Formatacao no padrao brasileiro. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${min}min ${rest}s` : `${min}min`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export const STYLE_LABELS: Record<string, string> = {
  classic: 'Classico (vermelho)',
  neon: 'Neon (vermelho eletrico)',
  gala: 'Gala (premiacao)',
};
