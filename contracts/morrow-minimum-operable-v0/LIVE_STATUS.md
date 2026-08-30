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
- `active_pr_id`: `P3-PR04`
- `active_route_node`: `CONPTY_MULTIPLEXING_AND_CLEANUP`
- `active_subaction`: `MERGE_PR_13_THEN_START_P3_PR04`
- `expected_branch_prefix`: `mvo/p3-pr03-`
- `write_execution_allowed`: `no product write before PR #13 merge; after merge, scoped only to P3-PR04 in a new dedicated branch`
- `next_authorized_action`: `START_P3_PR04`
- `next_authorized_actor`: `Executor/Test Designer/Security Reviewer after integration`

## Próxima ação exata

Integrar a PR #13 já provada. Depois, sincronizar `phase-2/runtime-v0`, executar regressão pós-merge e iniciar somente `P3-PR04` em nova branch dedicada para provar multiplexing, cleanup, timeout/cancel e colisões sob múltiplas sessões. Nenhum trabalho P3-PR04 pode começar antes do merge.

P3-PR03 passou probe Codex/ConPTY real, baseline quota, probe ConPTY `5/5`, testes focados `22/22`, suíte completa `155/155`, diff check e revisão adversarial final `GREEN`. O head remoto final `39faeaf` foi revalidado com mergeable `true`, state `clean`, 15 arquivos previstos e nenhum check remoto configurado. Dez achados foram corrigidos, incluindo snapshot pré-await e status auth positivo exato. Enova e qualquer target externo continuam proibidos.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `P3-INTEGRATION-03` | `integration` | P3-PR03 está provada na PR #13, ainda aberta | integrar PR #13 antes de criar a branch P3-PR04 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `READY` | P3-PR03 provada; P3-PR04 aguarda integração da PR #13 |
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
