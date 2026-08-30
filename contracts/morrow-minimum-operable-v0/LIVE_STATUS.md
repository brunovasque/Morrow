# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-08-30`
- `contract_version`: `1.0`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P3`
- `active_pr_id`: `P3-PR02`
- `active_route_node`: `CONPTY_BACKEND_IMPLEMENTATION`
- `active_subaction`: `P3_PR02_REMOTE_REVIEW_CORRECTIONS_LOCAL_GREEN`
- `expected_branch_prefix`: `mvo/p3-pr02-`
- `write_execution_allowed`: `yes, scoped only to P3-PR02 in a dedicated branch`
- `next_authorized_action`: `START_P3_PR02`
- `next_authorized_actor`: `Executor/Test Designer/Security Reviewer`

## Próxima ação exata

Publicar as correções adversariais da `P3-PR02` na PR [`#12`](https://github.com/brunovasque/Morrow/pull/12), confirmar base `phase-2/runtime-v0`, branch `mvo/p3-pr02-conpty-backend` e novo head exato, e reexecutar os gates contra esse head remoto. Não iniciar P3-PR03 e não marcar P3-PR02 como `PROVEN` antes da revalidação e integração.

O head remoto inicial `85b755c` foi revisado integralmente. A primeira suíte reproduziu um cruzamento de ambiente/histórico do operador (`146/147`) e a revisão encontrou também falha pós-spawn sem observer, liberação antecipada de handles/cwd e fallback de helper por PATH. O commit local `29974cf` corrige essas superfícies; probe Windows real `5/5`, suíte completa `149/149` e contraprovas de 512 KiB/removibilidade do workspace estão verdes. A revisão em `reviews/P3-PR02.md` permanece `GREEN_CANDIDATE` somente até publicação e revalidação remota. Enova e qualquer target externo continuam proibidos.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `none` | `none` | nenhum bloqueio ativo; correções da revisão remota estão verdes localmente | publicar somente P3-PR02 e revalidar o head remoto exato antes do merge |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `RUNNING` | PR #12 sobre `6168ade`; correções adversariais `29974cf` com probe 5/5 e suíte 149/149 aguardam publicação/revalidação remota |
| P4 | `BLOCKED` | depende de P2/P3 |
| P5 | `BLOCKED` | depende de P4 |
| P6 | `BLOCKED` | depende de P5 |
| P7 | `BLOCKED` | depende de P0-P6 |
| P8 | `BLOCKED` | depende de P7 |

## Baseline já comprovado

- kernel/event log/live state/PRE_DISPATCH;
- grafo adaptativo, reunião e invalidação de evidência;
- locks/checkpoints/workspaces/worktrees;
- Codex quota-session e shims Windows;
- sessões processuais ao vivo, múltiplas e isoladas;
- separação canônica dos terminais do operador;
- 130/130 testes passando após hardening e revisão remota P2-PR06;
- 141/141 testes passando no fechamento P3-PR01;
- 149/149 testes e probe ConPTY 5/5 passando após as correções adversariais locais P3-PR02.

Isso não autoriza declarar o produto operacional. `PRS.md` define o restante.

## Algoritmo determinístico de próxima ação

```text
if contract/addendum has owner decision open:
    next = resolve owner decision
else if Git/Event Log != LIVE_STATUS/EVIDENCE:
    next = reconcile state
else if blocking question exists:
    next = resolve question / meeting / diagnostic
else:
    candidates = PRS where status in [READY, PENDING]
                 and all dependencies are PROVEN
                 and required gates are green
    next = first candidate in MAP order
```

Se o resultado calculado divergir de `next_authorized_action`, o contrato fica `BLOCKED_STATE_DIVERGENCE`. Nenhum agente escolhe manualmente a alternativa mais conveniente.

## Protocolo de atualização

Ao iniciar uma PR:

1. reconciliar remote/base/status;
2. mudar PR para `RUNNING`;
3. registrar base SHA, objetivo e PRE_DISPATCH em `EVIDENCE.md`;
4. apontar `active_pr_id` para ela.

Ao concluir uma PR:

1. registrar candidate SHA, testes, review/audit e PR real;
2. marcar `PROVEN` somente se o gate específico passou;
3. atualizar fase e superfícies de regressão;
4. recalcular `next_authorized_action` pelo algoritmo;
5. registrar débito/adendo/pergunta antes de liberar a próxima.

## Instrução curta para nova aba

> Continue `MORROW-MVO-001`. Leia integralmente `contracts/morrow-minimum-operable-v0/README.md` e o pacote na ordem indicada. Reconcile Git com `LIVE_STATUS.md`; execute apenas `next_authorized_action`. Não use a conversa como fonte canônica e não toque em Enova/outros targets.
