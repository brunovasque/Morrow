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
- `active_pr_id`: `P3-PR03`
- `active_route_node`: `CODEX_QUOTA_SESSION_IN_CONPTY`
- `active_subaction`: `P3_PR03_LOCAL_REVIEW_GREEN_CANDIDATE`
- `expected_branch_prefix`: `mvo/p3-pr03-`
- `write_execution_allowed`: `yes, scoped only to P3-PR03 in a dedicated branch`
- `next_authorized_action`: `START_P3_PR03`
- `next_authorized_actor`: `Executor/Test Designer/Security Reviewer`

## Próxima ação exata

Fechar documentalmente o hardening `4b197b0`, repetir probe Codex/ConPTY, baseline quota, probe ConPTY, suíte completa, diff check e reconciliador; depois publicar a correção na PR #13, conferir mecanicamente base/branch/SHA e revalidar adversarialmente o diff remoto exato antes de qualquer merge.

A PR #12 foi integrada em `1d40eb7`; o head provado `a1c69a7` é ancestral da integração. A PR #13 foi aberta com head `8ed056b`; a revisão remota exata encontrou falso positivo possível no status auth, corrigido localmente em `4b197b0` com linha positiva exata e contraprova negativa. Probe real Codex/ConPTY verde com CLI `0.147.0`, modelo `gpt-5.6-sol`, provider `openai`, approval `never`, sandbox `read-only`, output anterior à conclusão, cwd correto e fixture intacta; baseline quota verde, probe ConPTY `5/5`, testes focados `22/22` e suíte `155/155`. Dez achados estão corrigidos; estado `GREEN_CANDIDATE` até publicar e revalidar o novo head. Enova e qualquer target externo continuam proibidos.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `none` | `none` | nenhum bloqueio ativo | publicar e revisar o head exato da P3-PR03; integrar somente após todos os gates verdes |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `RUNNING` | P3-PR03 em branch dedicada sobre `1d40eb7`; candidate local e review `GREEN_CANDIDATE`, aguardando publicação/revisão remota |
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
