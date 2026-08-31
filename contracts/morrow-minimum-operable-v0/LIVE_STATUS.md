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
- `active_subaction`: `P3_PR04_PUBLISH_REMOTE_ADVERSARIAL_REVIEW`
- `expected_branch_prefix`: `mvo/p3-pr04-`
- `write_execution_allowed`: `yes, scoped only to P3-PR04 in a dedicated branch`
- `next_authorized_action`: `START_P3_PR04`
- `next_authorized_actor`: `Executor/Test Designer/Security Reviewer`

## Próxima ação exata

Publicar o candidate local `ff744d2` de `P3-PR04` na branch `mvo/p3-pr04-conpty-multiplexing`, conferir base/head remotos e revisar adversarialmente o diff exato. Corrigir qualquer achado material na mesma branch e reexecutar soak, backend, suíte, diff check e reconciliador antes de integrar.

O candidate `ff744d2` passou soak final de 12 sessões, backend `7/7`, suíte `159/159` e regressões Codex quota-session. A revisão local está `GREEN_CANDIDATE`, não `PROVEN`; publicação, revisão do head remoto e pós-merge continuam obrigatórios. Fixtures ficam sob `.morrow-test-tmp`; terminais/projetos do operador, Enova e targets externos continuam proibidos.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `none` | `none` | nenhum bloqueio ativo | publicar e revisar somente o candidate P3-PR04; qualquer processo órfão, colisão aceita ou identidade ambígua reabre o candidate |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `RUNNING` | P3-PR04 candidate local `ff744d2` verde; publicação, review remoto e integração pendentes |
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
