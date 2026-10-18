import { randomInt } from 'node:crypto';

/**
 * Selecao aleatoria uniforme SEM reposicao, usando o gerador criptografico
 * do Node.js (crypto.randomInt) com amostragem de Fisher-Yates parcial.
 *
 * - Cada participante tem exatamente a mesma chance de ser sorteado.
 * - Ninguem e escolhido duas vezes na mesma rodada.
 * - A animacao nao participa desta decisao: o resultado e definido no backend
 *   e persistido antes de qualquer apresentacao.
 */
export function secureShuffle<T>(items: readonly T[], count: number): T[] {
  if (count <= 0) return [];
  if (count > items.length) {
    throw new Error('Quantidade solicitada maior que o total de participantes.');
  }
  const arr = items.slice();
  for (let i = 0; i < count; i += 1) {
    const j = i + randomInt(arr.length - i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, count);
}

/** Embaralhamento completo (usado para montar a lista visual da animacao). */
export function secureFullShuffle<T>(items: readonly T[]): T[] {
  return secureShuffle(items, items.length);
}
