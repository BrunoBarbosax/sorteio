/**
 * Variaveis de ambiente do runtime serverless da Netlify.
 *
 * O [build.environment] do netlify.toml vale apenas para o BUILD: a funcao em
 * execucao nao o enxerga. Estes padroes NAO-secretos sao aplicados aqui, antes
 * de qualquer modulo avaliar `env` (este arquivo e o primeiro import de
 * netlify.ts), e podem ser sobrescritos pelas variaveis do painel quando
 * necessario.
 *
 * - NODE_ENV=production: cookies de sessao com `secure` (site sempre HTTPS).
 * - DB_CLIENT=postgres: a Netlify nao tem SQLite persistente; se faltar
 *   DATABASE_URL a aplicacao falha cedo com mensagem clara em vez de gravar
 *   em arquivo temporario.
 * - TRUST_PROXY=1: tras o IP real do visitante (cabecalhos do proxy da
 *   Netlify); sem isso todo visitante compartilharia o mesmo balde de rate
 *   limit (o IP do edge da Netlify).
 * - PUBLIC_ORIGIN/ADMIN_NAME: usados pelo site e pela criacao do admin.
 */
process.env.NODE_ENV ??= 'production';
process.env.DB_CLIENT ??= 'postgres';
process.env.TRUST_PROXY ??= '1';
process.env.PUBLIC_ORIGIN ??= 'https://gorjeta77.netlify.app';
process.env.ADMIN_NAME ??= 'Administrador';

export {};
