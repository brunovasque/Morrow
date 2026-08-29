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
- `active_subaction`: `P2_PR06_PUBLISH_AND_REVIEW_REMOTE_HEAD`
- `expected_branch_prefix`: `mvo/p2-pr06-`
- `write_execution_allowed`: `yes, scoped only to P2-PR06 in a dedicated branch`
- `next_authorized_action`: `START_P2_PR06`
- `next_authorized_actor`: `Architect/Executor`

## Próxima ação exata

Atualizar e revisar somente a PR #10 da P2-PR06 na branch `mvo/p2-pr06-recovery`. O primeiro head remoto `3669c8a` revelou ausência de posse única da raiz, continuidade indevida no mesmo target com resultado incerto e leitura do snapshot antes do limite. O hardening `9b02ba5` corrige essas três superfícies e `bfecf40` prova o limite pré-leitura; testes focados passaram 13/13 e a suíte completa 122/122. O resultado permanece `RUNNING/GREEN_CANDIDATE`, não `PROVEN`, até publicação e revalidação do novo head remoto.

P2-PR05 foi integrada pela PR #9 em `9b96a8b`; a base integrada passou `109/109` e ficou limpa. Mantenha `GPT-5.6 Sol / xhigh` para P2-PR06, porque recovery e idempotência após restart são fronteiras críticas. Nesta PR permanecem proibidos ConPTY/P3, transcript/redaction/P4, credencial real, transporte de rede concreto e qualquer target externo, inclusive Enova.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `none` | `none` | nenhum bloqueio de preflight ativo | executar somente P2-PR06 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `RUNNING` | P2-PR06 em branch dedicada sobre `9b96a8b` |
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
