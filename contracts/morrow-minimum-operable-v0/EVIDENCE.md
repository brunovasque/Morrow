# Evidências — MORROW-MVO-001

## Baseline anterior ao contrato mestre

| unidade | status | commits / artefatos | prova | data |
|---|---|---|---|---|
| `P1-PR01` | `PROVEN_BASELINE` | `f44aace..24398de` | testes do kernel, live state, PRE_DISPATCH, loops, meeting e process adapter | 2026-08-28 |
| `P1-PR02` | `PROVEN_BASELINE` | `ff9e2c2..9e2c083` | locks, checkpoint, worktree e workspace security | 2026-08-28 |
| `P1-PR03` | `PROVEN_BASELINE` | `922e931..3931ce1` | adapter Codex quota-session, probes e shim Windows | 2026-08-28 |
| `P1-PR04` | `PROVEN_BASELINE` | `b04dc4f`, `e4a2805`, `ff0359c` | documentação observável + terminal process-backed; `npm test` 25/25 | 2026-08-28 |

## Execução corrente

| PR-ID | base SHA | candidate SHA | GitHub PR | checks | review/audit | resultado | data |
|---|---|---|---|---|---|---|---|
| `P0-PR01` | `ff0359c` | `4bcedb9` | bootstrap na branch de integração | links locais 0 quebrados; 9 fases; 42 PRs; 27 ACs cobertos; 43 requisitos; `npm test` 25/25; `git diff --check` verde | dono revisou e autorizou continuidade | `PROVEN` | 2026-08-28 |
| `P0-PR02` | `4bcedb9` | commit que contém review/contrato v1 | bootstrap na branch de integração | 29 ACs cobertos; 45 requisitos; links/IDs/dependências consistentes; `reviews/P0-PR02.md` | passes por responsabilidade + adversarial GREEN; owner approval registrada | `PROVEN` | 2026-08-28 |
| `P0-PR03` | `2f55046` | `2f34f1b` + fechamento da PR | `mvo/p0-pr03-contract-reconciler` | contraprovas de Git, dependências, mapa, rastreabilidade e preflight; `npm test` e `npm run contract:reconcile` verdes; próximo passo calculado é P2-PR01 | review interno GREEN; pacote fechado sem estado documental pendente | `PROVEN` | 2026-08-28 |
| `P2-PR01` | `37f28da` | código/teste `b9e7315`; head remoto revisado `2b67d8b` | [`PR #5`](https://github.com/brunovasque/Morrow/pull/5), `mvo/p2-pr01-worker-protocol`, merge state `CLEAN` | ADR + schema + decoder; `npm test` 48/48; compatibilidade, auth binding, scope, replay, ordering, TTL e body estrito atacados; `git diff --check` verde; 9 arquivos esperados | Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR02 somente após integração | `PROVEN` | 2026-08-28 |

## Registro obrigatório por PR futura

Cada linha nova deve incluir:

- objetivo exato e versão/hash do contrato/mapa;
- base/candidate SHA e URL/número do PR;
- comandos/checks realmente executados e resultado;
- evidência de Acceptance aplicável;
- Reviewer/Auditor/Security Reviewer e conclusão independente;
- superfícies invalidadas/revalidadas;
- eventos/reuniões/decisões/débitos relevantes;
- configuração runtime/model/effort/access efetiva;
- resultado `PROVEN | REJECTED | SUPERSEDED`.

Mensagem de agente, merge ou build verde isolado não é evidência suficiente.
