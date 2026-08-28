# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `0.1`
- `updated_at`: `2026-08-28`
- `contract_version`: `0.1-draft`
- `contract_state`: `DRAFT_OWNER_REVIEW`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P0`
- `active_pr_id`: `P0-PR01`
- `active_route_node`: `OWNER_REVIEW`
- `write_execution_allowed`: `no`
- `next_authorized_action`: `OWNER_REVIEW_CONTRACT_DRAFT`
- `next_authorized_actor`: `owner`

## Próxima ação exata

O dono deve revisar o pacote `MORROW-MVO-001` e responder uma das duas formas:

1. **aprovar o objetivo, envelope, aceitação, exclusões, fases e PRs como contrato v1**; ou
2. listar mudanças de destino/aceitação necessárias.

Após aprovação, a próxima unidade é `P0-PR02`: rodada independente + passe adversarial + CONTRACT_PREFLIGHT. Nenhuma implementação de P2 está autorizada antes disso.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `B-001` | `OWNER_APPROVAL` | draft ainda não foi aprovado como contrato v1 | decisão autenticada do dono |
| `B-002` | `PREFLIGHT` | passes independentes/adversarial ainda não foram executados | concluir P0-PR02 |
| `B-003` | `CONTROL` | validador mecânico de retomada ainda não existe | concluir P0-PR03 antes de P2 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `RUNNING` | pacote pronto para owner review |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `BLOCKED` | depende de P0 |
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
