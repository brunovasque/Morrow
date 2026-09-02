# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-09-02`
- `contract_version`: `1.0`
- `effective_addenda`: `A-001`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P4`
- `active_pr_id`: `P4-PR02`
- `active_route_node`: `STREAM_REDACTION_RETENTION_TRANSCRIPT`
- `active_subaction`: `P4_PR02_LOCAL_INDEPENDENT_SECURITY_REVIEW`
- `expected_branch_prefix`: `mvo/p4-pr02-`
- `write_execution_allowed`: `no for the next review; checkout must remain read-only`
- `next_authorized_action`: `START_P4_PR02`
- `next_authorized_actor`: `Security Reviewer in a local session distinct from the Executor`

## Próxima ação exata

Executar, em nova sessão e com revisor distinto do Executor, a revisão local independente de segurança autorizada por `A-001`. O checkout deve ser somente-leitura e fixado à base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e ao head de código `79382d421a9a6e9df2956007fb701d32d00c5952`; o escopo é transcript/redaction. O relatório deve registrar cobertura, ferramenta, testes, achados, limites e veredito. Qualquer P1/P2 bloqueia e retorna P4-PR02 ao ciclo. Não fazer merge durante a revisão e não tratar a prova local como equivalente ao serviço externo indisponível.

Reconciliação anterior ao adendo: PR #18 aberta, não draft, `MERGEABLE/CLEAN`, base remota `3657a070e5dc6b1e7b78fa1804761440c55efffc` e head remoto/documental `7fe28a32b597010cf4a869180ab640cfa2e2fb8e`, idêntico ao checkout e upstream naquele momento. O candidate de código permanece `79382d421a9a6e9df2956007fb701d32d00c5952`. Uma revisão independente do head `1d93161` reproduziu assignment PowerShell válido com quote escapada por backtick vazando em chunks/live/inspect/disco; revisões do mesmo head também reproduziram string controls, override de prototype, cursor rewrite sobre linha existente e scalars YAML quoted/plain. `79382d4` corrige as categorias estruturalmente, preserva negativos e cobre block sequence/dedent. Focused 21/21; suíte integral repetida 193/193 após controle verde do `D-013`. Clock/inode/count/lease PID-only permanecem em `D-014`..`D-017` para P4-PR03.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| nenhum | — | o gate externo está indisponível, mas o dono aprovou a substituição estrita `A-001`; a revisão local ainda não foi executada | executar a revisão local independente definida no adendo; P1/P2 passa a ser bloqueio técnico |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `PROVEN` | P3-PR04 integrada em `d4ccc73`; ConPTY 11/11 e suíte 164/164 verdes pós-merge, sem órfãos |
| P4 | `RUNNING` | P4-PR02 `GREEN_CANDIDATE` de código em `79382d4`; revisão local independente de segurança de `A-001`, merge e regressão pós-merge pendentes |
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
- P3-PR04 integrada em `d4ccc73`: isolamento de addon por host, IPC fail-closed, ConPTY 11/11 e suíte 164/164 pós-merge.

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
