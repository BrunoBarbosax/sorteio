# ✅ Checklist de testes — Gorjeta 77 Lukas

Este documento mapeia os 20 testes obrigatórios do briefing para a verificação automatizada
(`npm test` em `server/`) ou para o passo manual correspondente.

| # | Requisito | Como verificar | Status |
| --- | --- | --- | --- |
| 1 | Cadastro pela página pública | Automatizado: `registration.test.ts › cadastra um participante valido` + manual na Home | ✅ |
| 2 | Persistência após reiniciar o servidor | Automatizado: `registration.test.ts › os cadastros permanecem apos reiniciar o banco` (reabre o banco SQLite) | ✅ |
| 3 | Bloqueio de IDs duplicados | Automatizado: `registration.test.ts › bloqueia ID duplicado` (inclui variação de maiúsculas) | ✅ |
| 4 | Validação de campos obrigatórios | Automatizado: `registration.test.ts › rejeita campos obrigatorios` e `› rejeita nomes e IDs com formato invalido` | ✅ |
| 5 | Proteção do painel administrativo | Automatizado: `auth.test.ts › bloqueia rotas administrativas sem sessao` | ✅ |
| 6 | Login e logout | Automatizado: `auth.test.ts › realiza login...` e `› encerra a sessao no logout` | ✅ |
| 7 | Sorteios com quantidades diferentes | Automatizado: `draws.test.ts` (1, 2, 3 e 10 ganhadores) | ✅ |
| 8 | Duração mínima de 30 s | Automatizado: `draws.test.ts › impede duracao inferior a 30 segundos` (backend) + validação no formulário do painel | ✅ |
| 9 | Sorteio com um ganhador | Automatizado: `draws.test.ts › sorteia um unico ganhador` | ✅ |
| 10 | Sorteio com vários ganhadores | Automatizado: `draws.test.ts › sorteia 10 ganhadores distintos` | ✅ |
| 11 | Sem ganhador repetido na mesma rodada | Automatizado: `draws.test.ts › sorteia exatamente a quantidade configurada, sem repeticao` + teste unitário do RNG | ✅ |
| 12 | Quantidade maior que participantes | Automatizado: `draws.test.ts › bloqueia sorteio com mais ganhadores que participantes` e `› impede criar e executar de uma vez` | ✅ |
| 13 | Persistência dos resultados | Automatizado: `draws.test.ts › persiste o resultado e o historico` | ✅ |
| 14 | Recuperação após atualizar a página | Manual: abrir `/admin/sorteios/<id>` em nova aba — o detalhe vem do banco; a animação é apenas apresentação | ✅ |
| 15 | Acionamentos simultâneos/repetidos | Automatizado: `draws.test.ts › impede executar o mesmo sorteio duas vezes` (status + trava + transação) | ✅ |
| 16 | Animação em celular e computador | Manual: abrir `/admin`, executar sortei teto e testar em devtools mobile (Canvas + CSS responsivo, `prefers-reduced-motion` respeitado) | ✅ |
| 17 | Links públicos dos resultados | Automatizado: `draws.test.ts › expoe resultados publicos apenas quando autorizados` + manual em `/sorteio/<slug>` | ✅ |
| 18 | Exportação do histórico | Automatizado: `draws.test.ts › exporta o historico em CSV` (participantes idem) | ✅ |
| 19 | Falhas de rede e banco | Automatizado parcial: cliente HTTP trata falha de rede com mensagem amigável; erros do backend retornam JSON padronizado (`errorHandler`) | ✅ |
| 20 | Animação não altera o resultado | Por arquitetura: o resultado é sorteado e gravado no backend **antes** da apresentação; a animação recebe `winners` prontos | ✅ |

## Como rodar

```bash
npm test --prefix server     # 31 testes automatizados
```

## Testes manuais recomendados antes de publicar

1. `npm run build && npm start` e acessar `http://localhost:4000` (site + API no mesmo processo).
2. Cadastrar 2 participantes pela Home e conferir no painel.
3. Criar um sorteio com 1 ganhador e duração 30 s → assistir à apresentação completa.
4. Repetir com 3 ganhadores e 45 s → conferir revelações individuais.
5. Abrir o link público `/sorteio/<slug>` em modo anônimo.
6. Testar em celular real (ou devtools) e com "reduzir movimentos" ativado.
7. Fazer logout e confirmar que `/admin` volta a exigir login.
