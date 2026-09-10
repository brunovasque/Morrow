# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-09-10`
- `contract_version`: `1.0`
- `effective_addenda`: `A-001`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P4`
- `active_pr_id`: `P4-PR02`
- `active_route_node`: `STREAM_REDACTION_RETENTION_TRANSCRIPT`
- `active_subaction`: `P4_PR02_LOCAL_INDEPENDENT_SECURITY_REREVIEW`
- `expected_branch_prefix`: `mvo/p4-pr02-`
- `write_execution_allowed`: `no for the next review; checkout must remain read-only`
- `next_authorized_action`: `START_P4_PR02`
- `next_authorized_actor`: `Security Reviewer in a local session distinct from the Executor`

## Próxima ação exata

Executar, em nova sessão e com revisor distinto do Executor, a re-revisão local independente de segurança autorizada por `A-001`. O checkout deve ser somente-leitura e fixado à base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e ao novo head de código `95e808294395449b46438b799c0b7d480cece52d`; o escopo é o delta completo de transcript/redaction, incluindo as superfícies adicionais de opção CLI sensível, whitespace multiline, string-control fragmentado, terminador C1-ST em OSC, além da preservação fail-closed e das cercas CSI/VT estruturais. O relatório deve registrar cobertura, ferramenta, testes, achados, limites e veredito. Qualquer P1/P2 bloqueia e retorna P4-PR02 ao ciclo. Não fazer merge durante a revisão e não tratar a prova local como equivalente ao serviço externo indisponível.

O review local independente do candidate `79382d421a9a6e9df2956007fb701d32d00c5952` encontrou P2 real: ANSI cursor controls repetidos em uma única linha provocavam revarreduras completas por controle. Medição independente relatada: 8 KiB/54 ms, 15 KiB/215 ms, 30 KiB/659 ms e 60 KiB/3.460 ms. A reprodução local no código anterior mediu medianas 27,5/95,5/378,2/1.540,5 ms e o teste de 60 KiB falhou em 1.055,3 ms contra teto de 750 ms. O candidate anterior `a44daee73ac6bb9b91523a947a6e0154397efcee` eliminou as buscas bidirecionais por controle, fechou um range fail-closed por linha e preservou o início visível da linha sem revarrer backspaces; ele foi superseded/invalidated pelo microfix posterior `15e3ac733fc295d4cff3762de957f348a6e02c01`. Provas históricas do candidate `15e3ac7`: contraprova causal do prefixo de 30.720 maiúsculas em `1354,1 ms` RED contra teto `750 ms` e aproximadamente `24,8 ms` GREEN; contraprovas lexicais adicionais; focused `24/24`; regressão completa `196/196`. O Reviewer Luna xhigh independente emitiu `GREEN_MICROFIX`, que cobria somente o microfix e não equivaleu ao A-001 completo. `D-014`..`D-017` permanecem para P4-PR03.

Reconciliacao factual de 2026-09-09: o A-001 do candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` foi executado em nova sessão independente e ficou `BLOCKED` por P2 de bypass de redaction via VT CSI `b` / REP. O Executor reproduziu o RED (`pas<ESC>[1bword=VT_REPEAT_CANARY` produzindo `pasword=VT_REPEAT_CANARY`, com `redactionCount: 0` e vazamento em live, `inspect()` e `transcript-v1.json`), corrigiu a causa com tratamento fail-closed de REP e criou o candidate `ba350658a39f270cbc9ec559c193997a1a0db047`. Provas reportadas do novo candidate: focused `25/25`, `npm test` `197/197` e `git diff --check` GREEN. O novo candidate ainda não possui A-001 válido; `15e3ac7` está superseded/invalidated. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 continua não autorizada. A ação continua `START_P4_PR02`, para re-review independente do novo candidate.

Reconciliacao factual adicional de 2026-09-09: o A-001 do candidate `ba350658a39f270cbc9ec559c193997a1a0db047` permanece `BLOCKED` por P2 de bypass via composição HPA + DCH. O problema foi diagnosticado como classificação CSI estruturalmente insegura; o candidate `ba350658` foi superseded/invalidated pelo candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`, parent `c8bb6afda8640bc11b9b82d36d931374fd725153`, que contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`. A correção usa allowlist estrutural de SGR numérico comprovadamente inerte e fail-closed para demais CSI; string controls completos foram separados do classificador CSI, e o efeito colateral 7-bit/C1 detectado antes do commit foi corrigido antes do congelamento. Provas finais: focused `31/31`, controle ConPTY `GREEN`, regressão completa `203/203` e `git diff --check` `GREEN`; D-013 permanece aberto, sem correção ou ocultação e sem alteração ConPTY/P3. O novo candidate ainda não possui A-001 válido; P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 continua não autorizada. A próxima ação continua `START_P4_PR02`, para Security Reviewer independente em nova sessão Luna xhigh, revisando exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `P4-PR02-P2-001` | A-001 security gate | O candidate `dc0bbaf` foi superseded/invalidated antes de novo A-001 após contraprovas adicionais encontrarem superfícies ainda não cobertas; o candidate `95e808` ainda não tem A-001 válido | re-review independente, somente-leitura e fixado em `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`; não fazer merge antes de veredito sem P1/P2 |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `PROVEN` | P3-PR04 integrada em `d4ccc73`; ConPTY 11/11 e suíte 164/164 verdes pós-merge, sem órfãos |
| P4 | `RUNNING` | P4-PR02 `BLOCKED ON A-001`; `a44daee`, `15e3ac7`, `ba35065` e `dc0bbaf` são predecessors superseded/invalidated e `95e808` é o candidate atual; re-review local independente, merge e regressão pós-merge pendentes |
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

## Reconciliação factual de 2026-09-10

O candidate `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf` foi `SUPERSEDED`/`INVALIDATED` antes de novo A-001, após contraprovas adicionais encontrarem superfícies ainda não cobertas; não houve novo A-001 sobre `dc0bbaf`. O Executor reproduziu REDs para opção CLI sensível, assignment JSON com whitespace multiline antes do separador, custo superlinear de string-control incompleto fragmentado e terminador C1 incorreto em OSC com over-redaction. As causas foram boundary genérico sem chave sensível após opção CLI, whitespace sem CR/LF, `release()` reprocessando `pending` crescente e `terminalOscEnd()` sem C1-ST. O candidate `95e808294395449b46438b799c0b7d480cece52d` corrige essas superfícies com reconhecimento estrutural de opção CLI, whitespace multiline, scanner incremental bounded entre chunks e C1-ST em OSC, preservando as cercas CSI/VT estruturais. O Executor reportou focused `35/35`, primeira regressão `206/207` com a única falha histórica D-013, soak posterior GREEN com 12 sessões/PIDs distintos/`noOrphans: true`/fixture removida, reexecução `207/207` e medições reduzidas de segundos a poucos milissegundos no envelope `4k/8k/12k/16k`. D-013 segue aberto; não houve alteração ConPTY/P3, push, merge ou deploy. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, o candidate ainda não tem A-001 válido, merge é proibido e P4-PR03 não é autorizada. Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, no diff completo `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`.

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
