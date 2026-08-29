# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-08-29`
- `contract_version`: `1.0`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P2`
- `active_pr_id`: `P2-PR04`
- `active_route_node`: `ROUTING_AND_RESOURCE_GUARDS`
- `active_subaction`: `PUBLISH_AND_REVIEW_P2_PR04_CANDIDATE`
- `expected_branch_prefix`: `mvo/p2-pr04-`
- `write_execution_allowed`: `yes, scoped only to P2-PR04 in a dedicated branch`
- `next_authorized_action`: `START_P2_PR04`
- `next_authorized_actor`: `Architect/Executor`

## Próxima ação exata

Publicar `mvo/p2-pr04-routing-guards` no head local `8c68d87`, abrir a PR contra `phase-2/runtime-v0` e conferir branch, base, head, diff e estado remoto antes da revisão final.

P2-PR03 foi integrada em `7d3e91b`. O candidate local de P2-PR04 está `GREEN_CANDIDATE` com 94/94 testes, mas permanece `RUNNING` até o head remoto exato ser revisado. Mantenha `GPT-5.6 Sol / xhigh`. Nenhum dispatch, processo, shell, credencial, transporte, target externo ou cobrança real está autorizado nesta PR.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `none` | `none` | nenhum bloqueio de preflight ativo | executar somente P2-PR04 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `RUNNING` | P2-PR04 em branch dedicada sobre `7d3e91b` |
| P3 | `BLOCKED` | depende de P2 |
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
- 25/25 testes passando.

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
