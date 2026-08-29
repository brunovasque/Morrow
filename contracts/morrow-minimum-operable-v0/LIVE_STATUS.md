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
- `active_pr_id`: `P2-PR06`
- `active_route_node`: `WORKER_RECOVERY_AND_OFFLINE_STATE`
- `active_subaction`: `MERGE_PR_9_THEN_START_P2_PR06`
- `expected_branch_prefix`: `mvo/p2-pr06-`
- `write_execution_allowed`: `no product write before PR #9 merge; after merge, scoped only to P2-PR06 in a dedicated branch`
- `next_authorized_action`: `START_P2_PR06`
- `next_authorized_actor`: `Architect after integration`

## Próxima ação exata

Integrar a PR #9 já provada. Depois, iniciar `P2-PR06` em nova branch dedicada nascida da `phase-2/runtime-v0` atualizada e implementar somente reconnect, retry idempotente, fila, checkpoint e estado online/offline.

P2-PR05 foi revisada no head remoto `96dfdb0`, com `109/109`, 14 arquivos previstos, `mergeable: true`, merge state `clean` e parecer `GREEN`. Mantenha `GPT-5.6 Sol / xhigh` para P2-PR06, porque recovery e idempotência após restart são fronteiras críticas. Nenhuma escrita de P2-PR06 está autorizada antes da integração da PR #9.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `P2-INTEGRATION-05` | `integration` | P2-PR05 está provada na PR #9, ainda aberta | integrar PR #9 antes de criar a branch P2-PR06 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `READY` | P2-PR05 provada; P2-PR06 aguarda integração da PR #9 |
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
- 109/109 testes passando após hardening P2-PR05.

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
