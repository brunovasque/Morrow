# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-11-26`
- `contract_version`: `1.0`
- `effective_addenda`: `none_for_P4_PR04; A-001 historical only for P4-PR02`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P4`
- `active_pr_id`: `P4-PR04`
- `active_route_node`: `MULTI_SESSION_STREAM_API_OBSERVABILITY`
- `active_subaction`: `P4_PR04_INDEPENDENT_REVIEW_PENDING`
- `expected_branch_prefix`: `mvo/p4-pr04-`
- `write_execution_allowed`: `Only independent review of frozen candidate; no technical writes, push, PR or merge`
- `next_authorized_action`: `START_P4_PR04`
- `next_authorized_actor`: `Independent Reviewer P4-PR04, new read-only session`
- `p4_pr03_execution_root_sha`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`
- `p4_pr04_base_sha`: `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`
- `p4_pr04_branch`: `mvo/p4-pr04-multi-session-stream`
- `execution_root_sha`: `2ed65f83ad2f56e797712475dab0a5fe3e3e7c99`
- `candidate_sha`: `2ed65f83ad2f56e797712475dab0a5fe3e3e7c99`
- `opening_control_root_sha`: `6f593eab2b843220572d4849c6f1ff1ab8e3a6ee`
- `pr_identity_state`: `NOT_OPEN`
- `pr_number`: `none`
- `pr_head_sha_at_opening`: `not_applicable`
- `pr_base_sha_at_opening`: `not_applicable`
- `pr_state_at_opening`: `not_applicable`
- `merge_ready_state`: `NOT_READY_BEFORE_INDEPENDENT_REVIEW`
- `merge_ready_reason`: `security_review_green_independent_reviewer_and_audit_pending`
- `merge_authorized`: `no`
- `pre_merge_control_root_sha`: `not_applicable`
- `integrated_merge_sha`: `not_applicable`
- `integrated_merge_parents`: `not_applicable`
- `post_merge_regression_state`: `not_started`
- `regression_veto`: `not_started`
- `final_audit_state`: `not_started`
- `p4_pr03_state`: `PROVEN`
- `p4_pr04_state`: `RUNNING`
- `candidate_state`: `FROZEN_FOR_INDEPENDENT_REVIEW`
- `security_review_state`: `SECURITY_REVIEW_GREEN`

## Próxima ação exata

P4-PR04 permanece RUNNING, com candidato tecnico congelado `2ed65f83ad2f56e797712475dab0a5fe3e3e7c99`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`. SECURITY_REVIEW_GREEN confirmado, estresse independente 73/73 PASS, 14 achados e I1-I5 GREEN, regressao elevada congelada 286/286 conferida; risco residual ConPTY nao bloqueante neste gate. Proximo ator unico: Independent Reviewer P4-PR04 em sessao nova read-only, para escopo, roots, cobertura, evidencia e regressao; retornar REVIEW_READY_FOR_AUDITOR ou BLOCKED. Ver EVIDENCE. Sem escrita tecnica, push, PR, merge, deploy ou P5.

O review local independente do candidate `79382d421a9a6e9df2956007fb701d32d00c5952` encontrou P2 real: ANSI cursor controls repetidos em uma única linha provocavam revarreduras completas por controle. Medição independente relatada: 8 KiB/54 ms, 15 KiB/215 ms, 30 KiB/659 ms e 60 KiB/3.460 ms. A reprodução local no código anterior mediu medianas 27,5/95,5/378,2/1.540,5 ms e o teste de 60 KiB falhou em 1.055,3 ms contra teto de 750 ms. O candidate anterior `a44daee73ac6bb9b91523a947a6e0154397efcee` eliminou as buscas bidirecionais por controle, fechou um range fail-closed por linha e preservou o início visível da linha sem revarrer backspaces; ele foi superseded/invalidated pelo microfix posterior `15e3ac733fc295d4cff3762de957f348a6e02c01`. Provas históricas do candidate `15e3ac7`: contraprova causal do prefixo de 30.720 maiúsculas em `1354,1 ms` RED contra teto `750 ms` e aproximadamente `24,8 ms` GREEN; contraprovas lexicais adicionais; focused `24/24`; regressão completa `196/196`. O Reviewer Luna xhigh independente emitiu `GREEN_MICROFIX`, que cobria somente o microfix e não equivaleu ao A-001 completo. `D-014`..`D-017` permanecem para P4-PR03.

Reconciliacao factual de 2026-09-09: o A-001 do candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` foi executado em nova sessão independente e ficou `BLOCKED` por P2 de bypass de redaction via VT CSI `b` / REP. O Executor reproduziu o RED (`pas<ESC>[1bword=VT_REPEAT_CANARY` produzindo `pasword=VT_REPEAT_CANARY`, com `redactionCount: 0` e vazamento em live, `inspect()` e `transcript-v1.json`), corrigiu a causa com tratamento fail-closed de REP e criou o candidate `ba350658a39f270cbc9ec559c193997a1a0db047`. Provas reportadas do novo candidate: focused `25/25`, `npm test` `197/197` e `git diff --check` GREEN. O novo candidate ainda não possui A-001 válido; `15e3ac7` está superseded/invalidated. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 continua não autorizada. A ação continua `START_P4_PR02`, para re-review independente do novo candidate.

Reconciliacao factual adicional de 2026-09-09: o A-001 do candidate `ba350658a39f270cbc9ec559c193997a1a0db047` permanece `BLOCKED` por P2 de bypass via composição HPA + DCH. O problema foi diagnosticado como classificação CSI estruturalmente insegura; o candidate `ba350658` foi superseded/invalidated pelo candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`, parent `c8bb6afda8640bc11b9b82d36d931374fd725153`, que contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`. A correção usa allowlist estrutural de SGR numérico comprovadamente inerte e fail-closed para demais CSI; string controls completos foram separados do classificador CSI, e o efeito colateral 7-bit/C1 detectado antes do commit foi corrigido antes do congelamento. Provas finais: focused `31/31`, controle ConPTY `GREEN`, regressão completa `203/203` e `git diff --check` `GREEN`; D-013 permanece aberto, sem correção ou ocultação e sem alteração ConPTY/P3. O novo candidate ainda não possui A-001 válido; P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 continua não autorizada. A próxima ação continua `START_P4_PR02`, para Security Reviewer independente em nova sessão Luna xhigh, revisando exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`.

## Bloqueios atuais

| id | tipo | motivo | resolução |
|---|---|---|---|
| `P4-PR02-P2-001` | A-001 security gate | Encerrado: o A-001 do candidate `76a41db` passou como `GREEN_LOCAL_A-001`, sem P1/P2 | nenhuma re-review A-001 aberta; P4-PR02 está `PROVEN` |

## Status por fase

| fase | status | observação |
|---|---|---|
| P0 | `PROVEN` | contrato v1, review e reconciliador mecânico provados |
| P1 | `PROVEN_BASELINE` | 25 testes em `ff0359c` |
| P2 | `PROVEN` | Local Worker completo integrado em `06e2a4c` |
| P3 | `PROVEN` | P3-PR04 integrada em `d4ccc73`; ConPTY 11/11 e suíte 164/164 verdes pós-merge, sem órfãos |
| P4 | `RUNNING` | P4-PR02 e P4-PR03 `PROVEN`; closure-records integradas; P4-PR04 `RUNNING` na branch `mvo/p4-pr04-multi-session-stream`, base `78e1bfd`, rota multi-session stream/API/observability |
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
O candidate `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf` foi `SUPERSEDED`/`INVALIDATED` antes de novo A-001, após contraprovas adicionais encontrarem superfícies ainda não cobertas; não houve novo A-001 sobre `dc0bbaf`. O Executor reproduziu REDs para opção CLI sensível, assignment JSON com whitespace multiline antes do separador, custo superlinear de string-control incompleto fragmentado e terminador C1 incorreto em OSC com over-redaction. As causas foram boundary genérico sem chave sensível após opção CLI, whitespace sem CR/LF, `release()` reprocessando `pending` crescente e `terminalOscEnd()` sem C1-ST. O candidate `95e808294395449b46438b799c0b7d480cece52d` corrigia essas superfícies, mas seu A-001 posterior encontrou dois P2 e ficou `BLOCKED`; `95e808` está superseded/invalidated. D-013 segue aberto; não houve alteração ConPTY/P3, push, merge ou deploy.

## Reconciliação factual de 2026-09-10 — A-001 bloqueado e novo candidate

O A-001 independente do candidate `95e808294395449b46438b799c0b7d480cece52d`, em nova sessão Luna `xhigh`, revisou o delta completo `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d` e emitiu `BLOCKED` por dois P2: controle C1 stateful não reconhecido capaz de alterar a apresentação visual e reconstruir chave sensível em live, `inspect()` e snapshot persistido; e custo superlinear sob fragmentação, com aproximadamente 1.024/82 ms, 2.048/255 ms, 4.096/957 ms, 8.192/2.633 ms e 16.384/6.014 ms, assignments até aproximadamente 4.292 ms em 8.192 bytes. O focused ficou `35/35` GREEN; a primeira `npm test`, `207/207`; o soak falhou posteriormente somente em `D-013`; a segunda `npm test`, `206/207`, com a única falha também `D-013`; transcript/redaction permaneceu verde; `git diff --check` GREEN; worktree final limpa. `95e808` está `SUPERSEDED`/`INVALIDATED` e não pode ser usado como prova de integração.

O Executor reproduziu os dois P2. A correção posterior fechou estruturalmente C0/C1: somente controles comprovadamente textualmente inertes permanecem descartáveis; controles stateful, cursor/linha/tabulação/display/charset/flow-control/reservados ou desconhecidos passam a fail-closed. O primeiro cruzamento continua sendo redigido normalmente; scans seguintes são amortizados/batched; newline força reavaliação; `finish()` mantém a classificação final; `pending` permanece bounded e nenhuma liberação ignora o redactor. O candidate atual é `189c1ced569489508ceb7d052f5e2b521cf085dd`, parent `b1a3bdedf2d6131702661403bf31251761e8602a6`, mensagem `fix(p4-pr02): harden terminal controls and amortize stream scans`, contendo somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`. Provas: focused `39/39`, `npm test` `211/211`, `D-013` não apareceu nessa execução e `git diff --check` GREEN; conferência externa pré-congelamento confirmou fragmentação rápida além do holdback, texto comum `4.9 / 3.5 / 6.7 / 9.1 / 10.6 ms` e assignment seguro `1.4 / 1.6 / 3.9 / 6.2 / 7.5 ms` em 2k/4k/8k/12k/16k.

`189c1ce` ainda não possui A-001 válido. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; `D-013` continua dívida histórica aberta e não foi corrigida; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi feito. Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..189c1ced569489508ceb7d052f5e2b521cf085dd`.

## Reconciliação factual de 2026-09-10 — A-001 bloqueado e candidate atual

O A-001 completo do candidate `189c1ced569489508ceb7d052f5e2b521cf085dd` foi executado por Security Reviewer independente Luna `xhigh`, em nova sessão, e terminou `BLOCKED`. As classes anteriores C0/C1, CSI/VT, OSC/APC/DCS/PM/SOS, assignments, CLI/JSON/YAML/PowerShell, live/`inspect()`/persistência/reopen e complexidade dos cenários comuns foram revalidadas como verdes. O único finding bloqueante foi P2 — DoS algorítmico por newline fragmentado: focused `39/39` GREEN; primeira `npm test` `210/211`, única falha em `D-013`/ConPTY; soak somente com `D-013`; segunda `npm test` `211/211` GREEN; `git diff --check` GREEN; worktree limpa; medições aproximadas `8k 1,429s`, `12k 2,834s`, `16k 4,256s`; newline furava a janela de amortização e forçava `#ranges()` repetidamente sobre o holdback. `189c1ce` está `SUPERSEDED`/`INVALIDATED` e seu A-001 não é prova de integração.

O Executor reproduziu RED e removeu a exceção que fazia newline furar batching. Newline permanece pendente até janela amortizada ou `finish()`; nenhum threshold artificial ou parser novo foi criado; CRLF, multiline, C0/C1, CSI/VT, string-controls e demais cercas foram preservados. O candidate atual é `76a41db64343131dfc20b699bedfae491859f88b`, parent `479f44d8ecfe9668ac64ff8a9d547f82caf81f7d`, mensagem `fix(p4-pr02): amortize newline stream scans`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`. Provas: focused `42/42`, `npm test` `214/214`, `git diff --check` GREEN; `D-013` não apareceu na execução do Executor; somente os dois arquivos autorizados mudaram. Conferência externa pré-commit: LF `2k/4k/8k/12k/16k` `2,34 / 3,46 / 7,54 / 8,17 / 9,06 ms`; CRLF `1,52 / 1,86 / 3,99 / 7,91 / 9,17 ms`; chunk único e 1-byte com saída equivalente; contraprova sensível sem canário; após controle ConPTY, regressão completa `214/214` GREEN.

`76a41db` ainda não possui A-001 válido. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; `D-013` permanece aberto; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi realizado. Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`.

## Reconciliação factual de 2026-09-10 — A-001 GREEN_LOCAL do candidate atual

O A-001 completo foi executado por Security Reviewer independente GPT-5.6 Luna, effort `xhigh`, `quota-session`, sem API, em sessão nova e somente-leitura, sobre o objeto integral `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`. O veredito foi `GREEN_LOCAL_A-001`. A evidência registrou focused `42/42` GREEN, `npm test` `214/214` GREEN, `git diff --check` GREEN, ausência de D-013, probe ConPTY desnecessário, worktree final limpa, nenhum arquivo rastreado alterado pelo Reviewer e nenhum push, merge ou deploy.

A cobertura incluiu C0/C1; CSI, REP, movimentos, insert/delete/erase, queries/private/intermediates; SGR; OSC/APC/DCS/PM/SOS; formas 7-bit/C1 e incompletas; CR/LF/CRLF/backspace; assignments bare/camel/Pascal/snake/kebab/dotted/quoted; CLI; Authorization/Bearer/tokens/private keys; JSON/YAML/PowerShell e multiline; chunk único, chunks arbitrários e 1-byte; boundaries; live fragment por fragmento; `inspect()`/snapshot/reopen; abort/capacity; autorização; retenção; checksum; root safety; symlink/junction; getters/proxies/objetos hostis; frozen/detached. Nenhum canário alcançou live, `inspect()`, disco ou reopen; findings P1, P2, P3 e informational de segurança foram nenhum. As fronteiras 4095/4096/4097/8191/8192/8193 passaram sem liberação de canário. As medianas independentes em chunks de 1 byte, para 2k/4k/8k/12k/16k, foram: comum `1.591 / 1.617 / 4.745 / 5.668 / 7.213 ms`; assignment seguro `0.988 / 1.870 / 3.558 / 5.762 / 8.417 ms`; terminal `1.071 / 1.837 / 3.802 / 4.330 / 5.917 ms`; string-control `0.714 / 1.376 / 2.450 / 3.658 / 5.127 ms`; LF `0.774 / 1.530 / 3.733 / 6.203 / 9.835 ms`; CRLF `0.891 / 1.696 / 3.383 / 5.570 / 8.887 ms`; combinado adversarial `0.974 / 2.010 / 5.963 / 6.158 / 8.104 ms`.

Este registro atualiza somente o fato de que o gate A-001 exigido para o candidate passou. `GREEN_LOCAL_A-001` não equivale ao Security Review externo indisponível, não cria precedente para outras PRs, não torna P4-PR02 `PROVEN` e não autoriza por si só integração ou merge. P4-PR02 permanece `RUNNING`; a integração e a regressão pós-merge são etapas contratuais ainda requeridas. A projeção mecânica permanece `next_authorized_action: START_P4_PR02`.

## Reconciliação factual atual — P4-PR03 — Reviewer versionado e Auditor recheck

P4-PR03 permanece `RUNNING`. O `EXECUTION_ROOT_SHA` imutável é `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; o Control Root anterior revisado era `02d64f74ebff46bb8f79e545bcc60f6666f8da2c`. O Reviewer independente já executado em modo read-only, em sessão independente do Executor, emitiu `REVIEW_READY_FOR_AUDITOR`.

A primeira auditoria independente ocorreu depois do Reviewer e emitiu `AUDIT_BLOCKED`, classificado exclusivamente como `documentation`, `independence evidence` e `authorization`. O Auditor confirmou Execution Root e Control Root corretos, genealogia GREEN, delta técnico GREEN, Security Review fresh, cobertura/regressão suficiente, scope GREEN, EBUSY/D-013 não bloqueante, P3 conhecidos não bloqueantes e zero mutação. O bloqueio foi somente a ausência de versionamento do resultado do Reviewer e a projeção stale anterior.

Esta reconciliação versiona o Reviewer sem retroceder para Reviewer nem repetir Security Review. O próximo ator é o mesmo Auditor independente para recheck de documentation, independence evidence, authorization e da separação mecânica dos roots. O Integrator permanece proibido até `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR`; P4-PR04 continua `PENDING`.

## Reconciliação factual atual — P4-PR03 — Auditor GREEN versionado

P4-PR03 permanece `RUNNING`. O `EXECUTION_ROOT_SHA` imutável é `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`. O Control Root anterior era `c242c06a3cfa31f9b04ce28a325e4e434b4b0f17`; o Auditor revalidou esse objeto e o resultado é versionado por este novo Control Root documental.

O Auditor independente revalidou os blockers anteriores — `documentation`, `independence evidence` e `authorization` — e confirmou que todos foram resolvidos. Confirmou também genealogia GREEN, delta somente documental, zero mutação técnica, Reviewer versionado e independente, Security Review fresh, estado canônico coerente, reconciler `allowed=true` e zero mutação pelo Auditor.

Resultado factual: `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR`. Determinação explícita: `AUDIT_VERDICT_MUST_BE_VERSIONED_BEFORE_INTEGRATOR`.

O Integrator fica autorizado somente a fazer push da branch `mvo/p4-pr03-replay-rehydration`, abrir/atualizar a PR contra `phase-2/runtime-v0`, capturar PR number/id, head/base SHA e URL/metadata factual disponível, executar os gates pós-abertura exigidos pelo contrato e retornar ao próximo gate. Merge não está autorizado. Qualquer mudança técnica exige novo candidate e novo ciclo de review. P4-PR04 continua `PENDING`.

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

## START_P4_PR04 — kickoff e PRE_DISPATCH

P4-PR04 está `RUNNING` na base integrada `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`, na branch `mvo/p4-pr04-multi-session-stream`. P4-PR03 e P3-PR04 estão `PROVEN`; não há owner decision ou blocking question aberta. O próximo ator é o Executor P4-PR04 persistente, autorizado a executar a TASK versionada em `EVIDENCE.md`, sem push, PR, merge ou deploy.

O núcleo é a composição local `WorkerSessionStream`: catálogo estável por sessão, fan-out incremental filtrado, cursor/replay por sessão e reconstrução após restart usando Event Log, transcript/redaction, Live Activity e recovery já provados. Não há UI, rede, socket externo, Nexus ou nova autoridade nesta unidade. Security Review normal independente será obrigatório sobre o candidate completo antes da integração; A-001 não se aplica.

## Registro anterior — P4-PR04 candidate congelado, Security Review GREEN

O candidate HEAD `8c89bf7af2fc5609cc02acf70966098b3c6261e1` foi congelado após a correção de persistência terminal. O Security Review independente revalidou o objeto completo e emitiu `SECURITY_REVIEW_GREEN — P4_PR04_READY_FOR_INDEPENDENT_REVIEW`: focused P4-PR04 `5/5`, regressões relacionadas `121/121`, `git diff --check` GREEN, `npm run contract:reconcile` `allowed=true`/`READY_FOR_EXECUTION`, nenhum finding P1/P2 e worktree do Reviewer limpa, sem mutação e sem alteração do HEAD.

A contraprova de durabilidade reproduziu a indisponibilidade do append terminal: `completion` rejeitou com `worker_session_terminal_persistence_failed`; a sessão viva ficou `failed`, o reopen derivou `recoverable`/`offline`, o replay preservou somente `STARTED`, a sessão B permaneceu isolada e não houve unhandled rejection nem deadlock. O resultado não autoriza merge, PR ou integração.

P4-PR04 continua `RUNNING`, com `candidate_state=FROZEN_FOR_INDEPENDENT_REVIEW`; `START_P4_PR04` permanece a autorização coarse de unidade no reconciliador, não uma nova autorização de escrita. O próximo ator único é o Reviewer independente, em sessão nova e read-only, para conferir candidate, Security Review, escopo, cobertura, regressão, roots e limites. Não há owner decision ou pergunta bloqueante aberta.

## Registro anterior — P4-PR04 Reviewer BLOCKED e retorno ao Executor

O Reviewer independente bloqueou o candidate `8c89bf7af2fc5609cc02acf70966098b3c6261e1` por lacuna técnica/coverage: a composição `WorkerSessionStream` não liga `LiveActivity`, `PersistentTranscriptStore`, snapshot ou `WorkerRecoveryCoordinator`, embora a TASK exija live, replay, disco e reopen preservando essas fontes. A inspeção read-only confirma que `src/worker-session-stream.ts` importa somente `TerminalSessionManager`, `StreamRedactor` e `JsonlEventLog`; as primitivas restantes existem separadamente, mas não são consumidas pelo módulo.

O focused independente reportado ficou `1/5`; os quatro casos restantes falharam antes do harness por `EPERM` ao criar diretório temporário em `TEMP`. Esse resultado ambiental permanece inconclusivo para cobertura comportamental e não pode ser promovido a GREEN.

P4-PR04 permanece `RUNNING`; a Security Review GREEN anterior não se aplica automaticamente ao novo candidate. `START_P4_PR04` continua coarse e não autoriza PR, push, merge ou deploy. O candidate técnico `b1347fe004355eca8615c4f7662d77de7ee6f294` foi congelado mecanicamente pelo Relay na mesma unidade; o próximo ator único é o Security Reviewer independente, em sessão nova e read-only. CONTRACT.md, TARGET.md e a ordem das PRs permanecem inalterados.

## Registro anterior — P4-PR04 candidate b1347fe congelado

O Relay congelou mecanicamente o candidate `b1347fe004355eca8615c4f7662d77de7ee6f294` para P4-PR04. O commit altera somente `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`; a projeção anterior de `8c89bf7` foi superseded para esta unidade.

O novo delta compõe `PersistentTranscriptStore`, `WorkerRecoveryCoordinator`, `LiveActivity` e `WorkerSessionSnapshot` dentro do `WorkerSessionStream`, incluindo transcript/live activity por sessão e estados de recovery. Nenhum resultado de teste, Security Review, PR ou merge é declarado por esta reconciliação.

P4-PR04 continua `RUNNING`, com `candidate_state=FROZEN_FOR_SECURITY_REVIEW` e `security_review_state=SECURITY_REVIEW_PENDING`. O próximo ator único é o Security Reviewer independente, read-only, revisando exatamente o candidate `b1347fe004355eca8615c4f7662d77de7ee6f294`; não há owner decision, push, PR, merge ou deploy autorizado.

## Registro anterior — P4-PR04 candidate 42146b1 congelado

O Relay congelou mecanicamente o candidate `42146b10350ebacb778ffbbfba93500eb93bd7dd` na mesma unidade P4-PR04, após a recuperação de Git do Executor. O commit altera somente `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`; o candidate `b1347fe004355eca8615c4f7662d77de7ee6f294` fica preservado como histórico.

Esta reconciliação não declara resultado de teste, contraprova de segurança, PR, push, merge ou deploy. P4-PR04 permanece `RUNNING`, com `candidate_state=FROZEN_FOR_SECURITY_REVIEW` e `security_review_state=SECURITY_REVIEW_PENDING`; o próximo ator único é o Security Reviewer independente, em sessão nova e read-only, revisando exatamente `42146b10350ebacb778ffbbfba93500eb93bd7dd`.

## Registro anterior — P4-PR04 candidate 2ab1968 congelado

O Relay congelou mecanicamente o candidate `2ab1968fe654223bb727ce55e90ffef2d5f77948` na mesma unidade P4-PR04, após a recuperação de Git do Executor. O commit altera somente `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`; o candidate `42146b10350ebacb778ffbbfba93500eb93bd7dd` fica preservado como histórico.

Esta reconciliação não declara resultado de teste, contraprova de segurança, PR, push, merge ou deploy. P4-PR04 permanece `RUNNING`, com `candidate_state=FROZEN_FOR_SECURITY_REVIEW` e `security_review_state=SECURITY_REVIEW_PENDING`; o próximo ator único é o Security Reviewer independente, em sessão nova e read-only, revisando exatamente `2ab1968fe654223bb727ce55e90ffef2d5f77948`.

## Registro anterior — P4-PR04 candidate 98a32e7 congelado

O Relay congelou mecanicamente o candidate `98a32e7a7184801c855572bbb67192d4b1ec98a2` na mesma unidade P4-PR04, após a recuperação de Git do Executor. O commit altera somente `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`; o candidate `2ab1968fe654223bb727ce55e90ffef2d5f77948` fica preservado como histórico.

Esta reconciliação não declara resultado de teste, contraprova de segurança, PR, push, merge ou deploy. P4-PR04 permanece `RUNNING`, com `candidate_state=FROZEN_FOR_SECURITY_REVIEW` e `security_review_state=SECURITY_REVIEW_PENDING`; o próximo ator único é o Security Reviewer independente, em sessão nova e read-only, revisando exatamente `98a32e7a7184801c855572bbb67192d4b1ec98a2`.

## Reconciliação factual de 2026-09-11 — P4-PR04 candidate a6aee3e congelado

O Relay congelou mecanicamente o candidate `a6aee3e90a6af810ce52a425a6e16ea6281b54a7` na mesma unidade P4-PR04, após a recuperação de Git do Executor. O commit altera somente `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`; o candidate `98a32e7a7184801c855572bbb67192d4b1ec98a2` fica preservado como histórico.

Esta reconciliação não declara resultado de teste, contraprova de segurança, PR, push, merge ou deploy. P4-PR04 permanece `RUNNING`, com `candidate_state=FROZEN_FOR_SECURITY_REVIEW` e `security_review_state=SECURITY_REVIEW_PENDING`; o próximo ator único é o Security Reviewer independente, em sessão nova e read-only, revisando exatamente `a6aee3e90a6af810ce52a425a6e16ea6281b54a7`.

## 2026-11-25 — P4-PR04 Security Review BLOCKED (retorno ao Executor)

Parecer independente recebido do Security Reviewer via operador, realizado exclusivamente por DC, candidate `a6aee3e90a6af810ce52a425a6e16ea6281b54a7`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`. Veredito `BLOCKED`; a conclusao abaixo e relato do revisor, ainda nao reproduzida pelo Cerebro.

- P2-01: canario sintetico exposto no retorno de conclusao em stdout e stderr.
- P2-02: apos fechamento do stream, retorno `completed` sem evento terminal duravel.
- P2-03: transcript expoe registros de outro agente do mesmo contrato.
- P2-04: `T-Case` e `t-case` aceitas com mesmo streamId no Windows, invalidando replay de uma sessao.
- Focused 11/11 GREEN, incluindo processos simultaneos reais e reidratacao; regressao completa RED: tres falhas (EBUSY, EPERM e redaction SGR nao diagnosticada), um teste ignorado; diff-check GREEN, Git limpo e dependencias preservadas, segundo o revisor.
- Limitacao: impedimentos ambientais e regressao SGR nao resolvidos; nenhum log bruto ou contraprova executavel foi fornecido ao Cerebro nesta devolutiva. Nao promover a prova a GREEN.

Retorno autorizado ao Executor persistente, apos PRE_DISPATCH: reproduzir e corrigir os quatro P2 no mesmo lote; diagnosticar EBUSY/EPERM, SGR e teste ignorado; contraprovar cada falha e executar regressao cumulativa. Alterar apenas superficies causalmente necessarias, sem refactor lateral, sem relaxar controles/testes, sem novas dependencias. Registrar RED/GREEN, evidencias e checkpoint; congelar novo candidate e devolver ao Security Reviewer independente read-only. P4-PR04 permanece RUNNING; nenhum push, PR, merge, deploy ou P5 autorizado.

## 2026-11-25 - P4-PR04 checkpoint intermediario: correcoes aplicadas, prova pendente

Executor reportou reproducao 4/4 e aplicacao das quatro correcoes; Cerebro conferiu via DC HEAD 110a62a, alteracoes nao commitadas nos dois arquivos tecnicos, registros RED e falha EPERM no log. Nenhum novo candidate congelado. Baseline reportada: 260 PASS, 1 FAIL, 1 SKIP; SGR passou, EBUSY nao reproduzido, EPERM em symlink. Contraprovas pos-correcao, combinadas e regressao integral pendentes. O candidate anterior permanece bloqueado; P4-PR04 RUNNING. Proximo ator: mesmo Executor, concluir as validacoes e diagnostico ambiental, atualizar evidencias e devolver READY_FOR_FREEZE ou BLOCKED. Nao congelar nem integrar ate autorizacao. Nao iniciar P5.

## 2026-11-25 - P4-PR04 recuperacao validada; BLOCKED por permissao nativa de file symlink

HEAD `110a62a93e5c710f42c21d70fccda97639b6789a`; branch `mvo/p4-pr04-multi-session-stream`; worktree contem as correcoes P2 e provas, sem novo commit ou freeze. Contraprovas individuais, combinadas e adversariais GREEN: focused 17/17, duas sessoes/processos reais, reidratacao em novo Node, redaction, isolamento, replay, ausencia de terminal falso apos falha de persistencia. ConPTY 6/6; EBUSY resolvido no teardown das fixtures, SGR RED/GREEN deterministico e restart sincronizado por stdin, sem alterar implementacao funcional adicional. Ultima cumulativa `npm test`: 269 testes, 267 PASS, 2 FAIL, 0 SKIP/CANCELLED; exclusivamente EPERM ao criar file symlink nos testes D-015 e transcript. Junction ancestral e contraprova same-size D-015 passaram. Sem privilegio `SeCreateSymbolicLinkPrivilege` no token DC; nenhuma configuracao global alterada, nenhum teste nativo substituido por simulacao ou dispensado. Diff-check GREEN, dependencias identicas a base `78e1bfdc`. Ver EVIDENCE.md e `.morrow-test-tmp/p4-pr04-recovery/SHA256SUMS.txt`. Veredito do Executor: `BLOCKED` exclusivamente ambiental, nao `READY_FOR_FREEZE`. Proxima acao: obter autorizacao e ambiente DC Windows com permissao nativa para criar file symlink; executar ambas as provas obrigatorias e repetir cumulativa integral; devolver ao Cerebro antes de freeze. Preservar todas as correcoes, nao iniciar P5, nao push/merge/commit/freeze nesta etapa.

## 2026-11-25 - Cerebro: verificacao do bloqueio ambiental e decisao pendente

Conferencia read-only via DC: hashes SHA256 da regressao integral e focused coincidem com EVIDENCE; log confirma 267 PASS, 2 FAIL na syscall symlink e zero SKIP. Probe nativo confirma file symlink EPERM e junction GREEN; whoami /priv nao lista SeCreateSymbolicLinkPrivilege. Diff-check GREEN; sem delta nos package files. Estado segue RUNNING/BLOCKED, sem freeze. Proposta sujeita a autorizacao explicita do operador: executar apenas os testes necessarios do Morrow em processo temporario com permissao adequada, sem elevar o DC inteiro, alterar configuracoes globais ou tocar outros projetos. Registrar prova nativa, regressao e contexto de permissao; nenhuma aprovacao ou permissao foi concedida nesta verificacao.

## 2026-11-25 - Autorizacao do operador: elevacao temporaria restrita aos testes P4-PR04

Operador confirmou explicitamente a proposta do Cerebro apos esclarecimento do significado e risco da elevacao. Autorizacao unica e limitada: via DC, em D:\Morrow, usar processo temporario com permissao suficiente para criar file symlinks nos dois testes obrigatorios e, se necessario, executar a regressao cumulativa do mesmo candidato. Preferir menor privilegio e usar aprovacao UAC normal quando exigida; nao elevar o DC inteiro, nao contornar UAC, nao alterar politicas, Developer Mode, privilegios permanentes, dependencias ou outros projetos. Encerrar o processo elevado ao terminar; preservar a prova de 267 PASS sem elevacao. Executor persistente deve verificar o escopo e os comandos antes de executar, registrar contexto de permissao, logs, exit codes, hashes, zero SKIP e regressao, e devolver READY_FOR_FREEZE ou BLOCKED. Se UAC exigir interacao, solicitar ao operador apenas a aprovacao necessaria. P4-PR04 continua RUNNING, candidate anterior BLOCKED; sem commit, freeze, push, PR, merge, deploy ou P5 ate nova ordem. Esta autorizacao nao constitui evidencia de teste executado.

## 2026-11-25 - P4-PR04 READY_FOR_FREEZE (validacao concluida; freeze nao autorizado)

Execucao exclusivamente via DC em `D:\Morrow`, HEAD `110a62a93e5c710f42c21d70fccda97639b6789a`. Os dois testes antes impedidos por EPERM passaram nativamente 2/2 sob elevacao temporaria. Primeira cumulativa elevada default: 267/269, zero SKIP, dois RED ConPTY (timeout/EBUSY). Controle focused sem elevacao reproduziu EBUSY; contraprovas diretas de lifecycle e multiplex GREEN, com drenagem integral, 12 sessoes, isolamento, zero orfaos e cleanup real. Nova cumulativa elevada serial, com `node --experimental-strip-types --test --test-concurrency=1 test/*.test.ts`: 269/269 PASS, 0 FAIL/CANCELLED/SKIP/TODO, exit 0. Mesma suite integral, sem alteracao de testes, timeouts, codigo ou dependencias nesta etapa; apenas concorrencia entre arquivos reduzida, mantendo sessoes simultaneas reais. Ambos file symlinks, ConPTY, SGR, P2 e contraprovas passaram. Logs separados em `.morrow-test-tmp/p4-pr04-recovery/elevated-run-01/` e `elevated-run-02/`, com SHA256SUMS. PIDs elevados 28316 e 4756 encerrados, DC confirmado nao elevado. Autorizacao temporaria consumida; nenhuma politica ou permissao permanente modificada. Diff-check e dependencias GREEN. Veredito do Executor: `READY_FOR_FREEZE`. O worktree corrigido ainda nao foi congelado; candidate anterior permanece SECURITY_REVIEW_BLOCKED, nao promovido. P4-PR04 permanece RUNNING. Proximo: Cerebro/operador autorizar expressamente freeze do novo candidate e encaminhar Security Review independente. Nenhum commit, push, PR, merge, deploy ou P5 nesta etapa.

## 2026-11-25 - Cerebro: autorizacao de freeze P4-PR04

DC confirmou SHA256 dos logs elevados 01 e 02, exit codes 0 dos dois testes de file symlink, cumulativa serial 269/269 PASS, zero FAIL/SKIP/CANCELLED/TODO, e ausencia dos PIDs elevados 28316 e 4756. Cumulativa default 267/269 e focused ConPTY 0/2 preservados; controles diretos GREEN (lifecycle 524288 bytes; multiplex 12 sessoes, noOrphans true). A intermitencia sob carga nao esta definitivamente resolvida; Reviewer/Auditor deve avaliar causalidade e sufiencia das provas, sem presumir REGRESSION_VETO PASS. Diff-check GREEN, package files intactos. Autorizado somente freeze local do worktree recuperado, sem nova alteracao funcional. Fixar SHA, registrar delta integral contra 78e1bfdc e contra candidato anterior, evidencias/hashes, invalidar candidato anterior e atualizar estado vivo, PRS e MAP para Security Review independente PENDING. Commit tecnico e registro documental separados se necessario; preservar logs anteriores, reconciliar Git limpo. Proibidos push, abertura de PR, merge, deploy e P5. A autorizacao de elevacao temporaria ja encerrou; eventual nova necessidade exige nova autorizacao. Nao equivale a Security Review GREEN nem integracao.

## 2026-11-25 - P4-PR04 FROZEN_AWAITING_SECURITY_REVIEW

- Freeze local autorizado pelo Cerebro, exclusivamente via DC em D:\Morrow. Candidate/Execution Root tecnico `08e2df00ca87c27f403e835fe63a7479e68a293c`, parent `110a62a93e5c710f42c21d70fccda97639b6789a`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`, branch `mvo/p4-pr04-multi-session-stream`. Candidate anterior `a6aee3e90a6af810ce52a425a6e16ea6281b54a7` SUPERSEDED/INVALIDATED; Security Review BLOCKED anterior permanece historico.
- Conteudo validado preservado: SHA256 dos seis arquivos tecnicos do worktree antes/depois identicos; blobs Git antes do stage, no index e no commit identicos. Commit tecnico: runtime/MULTI_SESSION_STREAM_API.md, src/worker-session-stream.ts, test/codex-conpty-adapter.test.ts, test/stream-transcript.test.ts e test/worker-session-stream.test.ts. Delta contra base: estes cinco caminhos e schema/worker-session-stream.v1.schema.json; 6 arquivos, 1878 insercoes/19 remocoes. Contra candidate anterior: 5 arquivos, 355 insercoes/46 remocoes. Diff-check GREEN; package.json/package-lock.json sem delta contra base.
- Inventarios de evidencias reconferidos integralmente: .morrow-test-tmp/p4-pr04-recovery/SHA256SUMS.txt, elevated-run-01/SHA256SUMS.txt, elevated-run-02/SHA256SUMS.txt, CONPTY-ELEVATION-CONTROLS-SHA256.txt. Freeze: freeze-01/SHA256SUMS.txt (SHA256 EFC85FB820938738D1DCA2926B5478263FE42D50C554056D5789D19D57F3677C), com blobs antes/congelados, SHA256 do worktree, patches integrais/tecnicos e paths contra base/candidate anterior. Cumulativa serial elevada 269/269 PASS, zero FAIL/SKIP/CANCELLED/TODO, exit 0; SHA256 do log 7851D4E2E4B22FB3DC989A9DE293D234D9612394CA029822FB0EC73173A14B35. Focused 17/17; P2 individuais/combinadas/adversariais GREEN; ambos file symlinks GREEN. Processos elevados encerrados, autorizacao temporaria consumida. Cumulativa elevada default 267/269, focused ConPTY 0/2 e controles diretos lifecycle/multiplex GREEN preservados. Intermitencia ConPTY EBUSY/timeout sob carga permanece ressalva obrigatoria de avaliacao independente; nao presumir REGRESSION_VETO PASS. Nenhuma nova elevacao, teste ou alteracao funcional no freeze.
- P4-PR04 RUNNING; candidate FROZEN_FOR_SECURITY_REVIEW; SECURITY_REVIEW_PENDING. Proximo ator unico: Independent Security Reviewer P4-PR04, sessao nova read-only, revisando SHA exato. Registro documental separado do tecnico. START_P4_PR04 permanece coarse; sem push, PR, merge, deploy ou P5.

## 2026-11-25 - P4-PR04 Security Review BLOCKED: novos achados, retorno ao Executor

Parecer independente em .morrow-test-tmp/p4-pr04-review-08e2df00/SECURITY_REVIEW_BLOCKED.md, SHA256 661D35992576A2EA1779D69F55722FB3AAB3BC4BD269F8D2A50B22767E3A384A, candidate `08e2df00ca87c27f403e835fe63a7479e68a293c`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`. Cerebro conferiu o parecer e Git limpo via DC; reproducoes sao do Reviewer.

- P2-01..04 GREEN independente, focused 17/17; duas sessoes ConPTY reais simultaneas e restart passaram no cenario testado.
- P2-05: redaction de argumentos sensiveis separados insuficiente em live/replay/transcript/event log.
- P2-06: snapshot associa terminal estrangeiro apenas por terminalSessionId, sem identidade canonica completa.
- P2-07: reutilizacao de identidade historica apos restart admite eventos indevidos, falsa conclusao e quebra de reopen.
- P3-01: flush do redator perde canal nativo terminal e classifica como stdout.
- Cumulativa independente nao elevada 265/269, zero SKIP; dois EPERM antes das assercoes, bootstrap Event Log race e alias EBADF (3/3 em retries isolados cada), causas nao estabelecidas. Houve sobreposicao de probes. Prova serial anterior 269/269 valida historicamente, nao elimina intermitencia sob carga.

Decisao: BLOCKED; retornar ao Executor persistente apos PRE_DISPATCH, corrigir os quatro novos achados no mesmo lote, preservar quatro P2 anteriores. Examinar todos os limites equivalentes de entrada/saida, identidade canonica, ciclo historico e canais (sem expandir escopo); contraprovas RED/GREEN individuais, combinadas e adversariais antes do freeze. Diagnosticar bootstrap/EBADF/ConPTY, executar cumulativa em host sem probes concorrentes e registrar condicoes, comandos, exit codes e hashes; nenhuma prova omitida, simulada ou relaxada. Nao usar autorizacao UAC anterior; se indispensavel solicitar nova autorizacao pontual. Entregar READY_FOR_FREEZE ou BLOCKED, sem novo freeze ate ordem. P4-PR04 RUNNING; sem push, PR, merge, deploy ou P5.

### 2026-11-25 22:48 BRT ? P4-PR04 recovery checkpoint (BLOCKED)
- Recovery base: c7b905a4bb451b3c82ca3bfc207bae16b30fec26; prior frozen candidate 08e2df00 remains BLOCKED, unchanged. Reconciliation allowed recovery, not freeze.
- P2-05/06/07 and P3-01: 4/4 reproduced RED and corrected; prior 17 worker tests preserved; worker focused final 23/23 PASS, governance 24/24 PASS, zero skips. Combined native ConPTY and adversarial identity/admission/replay tests PASS.
- Bootstrap partial-publication race reproduced deterministically and corrected; EBADF double descriptor ownership reproduced 8/8 and corrected to single FileHandle ownership; bounded ConPTY fixture cleanup added, with existing deadlines/orphan checks preserved. Full lifecycle/multiplex regression still pending; do not claim definitive elimination of intermittent failures.
- Cumulative regression: NOT STARTED. Preflight at 22:48:48 found two external MKT Node test processes (24548, 29008). DC non-elevated; two mandatory native file-symlink proofs require fresh scoped temporary elevation. Prior elevation authorization consumed. No external project/process altered.
- Next: obtain explicit fresh permission for only the Morrow elevated regression process; coordinate an exclusive host window, verify no external tests before/during execution, run complete serial suite (276 expected tests), record exits, logs, hashes and process termination. No skips, no persistent permission changes. If overlap or failure occurs, retain BLOCKED.
- Evidence: .morrow-test-tmp/p4-pr04-recovery-c7b905a/; SHA256SUMS.txt hash BF22F63DB18E9777A983A2136B7236A77953523CB766A4573C729E19E733E5C7; technical-delta.patch and regression-preflight.txt preserved. No dependency changes, commit, push, freeze or P5.

## 2026-11-25 - Cerebro: gate de regressao isolada e autorizacao pendente

DC conferiu checkpoint do Executor, HEAD c7b905a, worktree recuperado preservado e diff-check GREEN. Consulta read-only encontrou processo Node de teste externo PID 17488 no momento da verificacao. Nao encerrar ou alterar processos de outros projetos. Cumulativa 276 testes ainda nao executada; nao declarar ConPTY ou regressao integral GREEN. Aguardar encerramento natural dos testes externos e coordenacao do operador para janela exclusiva; nova elevacao temporaria restrita ao processo de regressao do Morrow requer autorizacao explicita do operador, anterior consumida. Sem freeze, commit ou integracao. Nenhuma permissao alterada.

## 2026-11-25 - Autorizacao do operador: regressao serial elevada e janela exclusiva P4-PR04

Operador autorizou explicitamente nova elevacao administrativa temporaria, restrita ao processo de regressao completa do Morrow (276 testes esperados), via DC, em D:\Morrow. Operador informou quatro frentes simultaneas (Atria, Marketing, Morrow, Comercial); proposta de coordenacao: desenvolvimento simultaneo, mas uma regressao pesada por vez. Executor deve confirmar janela sem testes externos antes de iniciar, monitorar durante a execucao, nao executar contraprovas paralelas e nao interromper processos de outros projetos. Se houver sobreposicao, registrar e manter BLOCKED ate nova janela. Usar UAC normal se necessario, menor privilegio, sem elevar DC inteiro, alterar politicas ou permissoes permanentes, ou tocar outros projetos. Encerrar processo elevado ao concluir e registrar logs, hashes, exit codes, contexto de permissao, zero SKIP e integridade. Preservar todas as correcoes e evidencias. Retornar READY_FOR_FREEZE ou BLOCKED fundamentado; sem commit, freeze, push, PR, merge, deploy ou P5 ate nova ordem. Esta autorizacao nao constitui evidencia de execucao nem garante disponibilidade exclusiva do host.

## 2026-11-25 23:01 BRT - P4-PR04 recovery READY_FOR_FREEZE (freeze nao autorizado)

- Autorizacao temporaria do operador aplicada exclusivamente a regressao Morrow via DC em D:\Morrow; HEAD c7b905a4bb451b3c82ca3bfc207bae16b30fec26. Preflight inicial encontrou workloads Marketing e Comercial; aguardado encerramento natural. Nenhum processo externo encerrado, pausado ou alterado. Duas tentativas elevadas 01/02 encerradas antes de iniciar Node por falso positivo do proprio launcher DC e da consulta de acompanhamento; corrigido somente detector de workloads, sem alteracao de codigo/testes do Morrow. Registros originais preservados.
- Terceira tentativa elevated-cumulative-03: processo elevado PID 19684, Node PID 21132, Node v24.14.1, comando node --experimental-strip-types --test --test-concurrency=1 test/*.test.ts. Regressao integral 276/276 PASS, 0 FAIL/CANCELLED/SKIP/TODO, 113587.1554 ms, stderr vazio. P2-01..07, P3-01, bootstrap deterministico e concorrente, alias/EBADF, D-015 e snapshot file symlink, SGR, ConPTY lifecycle/multiplex e integracao nativa simultanea passaram na mesma suite. Nenhum teste omitido ou relaxado nesta rodada.
- Isolamento: 3 amostras nao elevadas antes de solicitar UAC; 57 amostras elevadas antes/durante/apos a suite, 0 observacoes de workload externo e 0 erros de monitoramento. Monitor por snapshots periodicos de processos de testes/builds; nao garante cobertura de processos muito breves entre amostras. Nao se afirma eliminacao definitiva da intermitencia ConPTY sob carga.
- Processos elevados 9616, 19628 e 19684, Node 21132 e respectivos launchers confirmados encerrados; ultimo encerramento 23:01:21.0724300-03:00. DC permanece nao elevado; nenhuma politica/configuracao/permissao permanente alterada. Autorizacao temporaria consumida.
- Ressalva de captura: launcher.exit = 0 observado; full.exit e worker.exit vazios por falha de captura de ExitCode do objeto Start-Process. Codigo de saida direto do Node UNRECORDED, nao presumido nem preenchido; consulta read-only ao log Security indisponivel sem privilegio adicional. Evidencia do PASS e a sumula integral explicita do runner, sem stderr, com processo encerrado. Executor considera suficiente para READY_FOR_FREEZE do worktree, sujeito a verificacao independente pelo Cerebro; nao equivale a REGRESSION_VETO PASS ou SECURITY_REVIEW_GREEN.
- Evidencias .morrow-test-tmp/p4-pr04-recovery-c7b905a/: elevated-cumulative-03/full.log SHA256 ED2ADB26FFD45B12B525FC66069DA2F7AFC9678ADE986F66A2B3B1BF57115502; host-monitor.jsonl SHA256 E8D6463DAC07D01CD16C0E29D0343BB085DB8D0025BF8D155169104C60790DA0; FINAL_VERIFICATION.txt; FINAL-REGRESSION-SHA256SUMS.txt SHA256 60E53E87B9C7CCF674729B970E83A1850972AEBEF3A7533E179B4E72DCE57B5F, inventarios das 3 tentativas e preflight. Manifesto anterior BF22F63DB18E9777A983A2136B7236A77953523CB766A4573C729E19E733E5C7 reconferido integralmente; hashes tecnicos do checkpoint identicos, diff-check 0, dependencias sem delta. Nenhuma alteracao funcional nesta etapa.
- Disposicao: READY_FOR_FREEZE apenas para worktree recuperado, ainda nao congelado; candidato anterior 08e2df00ca87c27f403e835fe63a7479e68a293c permanece SECURITY_REVIEW_BLOCKED. P4-PR04 RUNNING. Proximo: Cerebro verificar evidencia e autorizar expressamente novo freeze, depois revisao independente. Sem commit, freeze, push, PR, merge, deploy ou P5.

- Reconciliacao apos registro final: `allowed: false`, `BLOCKED_STATE_DIVERGENCE`, motivo unico `git_worktree_dirty`, exit 1. O worktree recuperado e os registros ainda estao sem commit por ordem expressa de nao congelar. Isso nao altera a sumula 276/276 nem constitui autorizacao de merge; o gate de reconciliacao deve ser repetido apos freeze autorizado. READY_FOR_FREEZE descreve somente a disponibilidade tecnica para o proximo freeze.

## 2026-11-26 - Cerebro: freeze autorizado com ressalva de captura

DC conferiu sumula integral 276/276, zero fail/cancelled/skipped/todo, stderr vazio, launcher.exit 0, monitor 57 amostras sem observacao externa, hashes dos logs e dos nove arquivos tecnicos do checkpoint (zero divergencias), diff-check GREEN, package files sem delta e PIDs elevados/teste ausentes. Codigo de saida direto do Node e worker nao registrado (arquivos vazios); nao inferir nem preencher retrospectivamente. Corrigido erro de transcricao do SHA256 do monitor na documentacao, sem alterar evidencias brutas: E8D6463DAC07D01CD16C0E29D0343BB085DB8D0025BF8D155169104C60790DA0. Autorizar somente freeze local da arvore recuperada para revisao independente; nao equivale a REGRESSION_VETO PASS. Revisor deve conferir integralmente cobertura, seguranca, alteracoes causais nos modulos anteriores, intermitencia sob carga e obter prova candidata com exit code direto corretamente capturado antes do gate de aprovacao; nova elevacao exige autorizacao do operador. Executor deve preservar hashes, criar commit tecnico separado do documental, invalidar candidato anterior, atualizar LIVE_STATUS/EVIDENCE/MAP/PRS e confirmar reconciliador e Git limpo. Sem push, PR, merge, deploy ou P5. Nenhuma nova elevacao ou teste executado pelo Cerebro.

## 2026-11-26 - P4-PR04 FROZEN_AWAITING_SECURITY_REVIEW

- Freeze local autorizado pelo Cerebro, exclusivamente via DC em D:\Morrow. Candidate/Execution Root tecnico `6372857cb645f994d31125bdb4ed8baef97591c8`, parent `c7b905a4bb451b3c82ca3bfc207bae16b30fec26`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`, branch `mvo/p4-pr04-multi-session-stream`. Candidate anterior `08e2df00ca87c27f403e835fe63a7479e68a293c` SUPERSEDED/INVALIDATED; seu Security Review BLOCKED por P2-05..07/P3-01 permanece historico, sem transferir aprovacoes.
- Os nove arquivos tecnicos recuperados conferem integralmente com o checkpoint validado, SHA256 antes/depois identicos e blobs Git antes do stage/no index/no commit identicos. Commit tecnico exclusivamente runtime/MULTI_SESSION_STREAM_API.md, src/event-log.ts, src/governance-registries.ts, src/probes/conpty-multiplex.ts, src/stream-transcript.ts, src/worker-session-stream.ts, test/fixtures/windows-conpty-lifecycle-child.ts, test/governance-registries.test.ts e test/worker-session-stream.test.ts: 9 arquivos, 525 insercoes/71 remocoes contra candidate anterior. Delta tecnico integral contra base inclui tambem schema/worker-session-stream.v1.schema.json, test/codex-conpty-adapter.test.ts e test/stream-transcript.test.ts: 12 arquivos, 2355 insercoes/42 remocoes. Diff-check GREEN; package.json/package-lock.json sem delta contra base. Nenhum novo teste, elevacao ou mudanca funcional no freeze.
- Evidencias reconferidas: .morrow-test-tmp/p4-pr04-recovery-c7b905a/SHA256SUMS.txt, FINAL-REGRESSION-SHA256SUMS.txt e os tres inventarios elevated-cumulative-01/02/03. Freeze: freeze-01/SHA256SUMS.txt (SHA256 5056FED947EBDC8FE786CEE9990B4AA97FCAEDE25E10E56F7E7E2D9B4155E637) com SHA do candidate, hashes tecnicos e blobs antes/depois, patches integrais e tecnicos, paths e estatisticas contra base e candidate anterior. Manifesto final anterior 60E53E87B9C7CCF674729B970E83A1850972AEBEF3A7533E179B4E72DCE57B5F preservado. Cumulativa serial elevada 276/276 PASS, 0 FAIL/CANCELLED/SKIP/TODO, stderr vazio, log SHA256 ED2ADB26FFD45B12B525FC66069DA2F7AFC9678ADE986F66A2B3B1BF57115502; monitor SHA256 E8D6463DAC07D01CD16C0E29D0343BB085DB8D0025BF8D155169104C60790DA0, 57 amostras e zero interferencias detectadas. Worker focused 23/23, governance 24/24, P2 anteriores e novos/P3-01, contraprovas combinadas/adversariais, bootstrap, EBADF, SGR, ConPTY e symlinks nativos passaram. Todos os processos elevados encerrados; autorizacao temporaria consumida.
- Ressalvas obrigatorias: duas tentativas iniciais abortadas antes dos testes por falsos positivos do monitor; monitor por amostragem nao garante ausencia de processos breves. Launcher exit 0 observado, full.exit e worker.exit vazios: exit code direto do Node nao registrado, sem preenchimento retroativo. ConPTY sob carga nao comprovadamente livre de intermitencia. Revisor independente deve avaliar cobertura, seguranca, alteracoes causais inclusive modulos anteriores, intermitencia e obter prova do candidate com exit code direto corretamente capturado antes do gate de aprovacao; nova elevacao exige autorizacao expressa do operador. Freeze nao equivale a REGRESSION_VETO PASS nem SECURITY_REVIEW_GREEN.
- P4-PR04 RUNNING; candidate FROZEN_FOR_SECURITY_REVIEW; SECURITY_REVIEW_PENDING. Proximo ator unico: Independent Security Reviewer P4-PR04, sessao nova read-only, SHA exato contra base e candidate anterior. Registro documental separado do tecnico. START_P4_PR04 coarse; sem nova escrita tecnica, push, PR, merge, deploy ou P5.

## 2026-11-26 - Security Review BLOCKED, recuperacao por invariantes

Parecer independente do candidate `6372857cb645f994d31125bdb4ed8baef97591c8`: P2-08..12 e P3-02 bloqueantes, oito anteriores GREEN, cumulativa 274/276 (dois EPERM) e estresse 64/64. Rota e matriz I1-I5 detalhadas em EVIDENCE.md. Executor persistente autorizado a diagnosticar, provar e corrigir causas comuns somente dentro de P4-PR04; sem freeze, elevacao sem nova autorizacao, push, PR, merge, deploy ou P5.

## 2026-11-26 - P4-PR04 diagnostico por invariantes concluido

PRE_DISPATCH GREEN em f0a166b; seis novos achados reproduzidos, oito anteriores preservados como regressao obrigatoria. Matriz causal I1-I5 registrada em EVIDENCE antes de qualquer mudanca funcional. Proxima acao: correcao causal das fronteiras existentes e testes permanentes. Sem freeze, elevacao ou P5.

## 2026-11-26 - P4-PR04 correcoes e prova causal

Worktree recuperado sobre f0a166b, ainda sem freeze: seis contraprovas RED permanentes, alteracoes causais nos limites existentes e prova focused 69/69 GREEN, exit direto 0, incluindo os 14 achados e dupla ConPTY reforcada. Uma falha inicial de fixture nativa foi diagnosticada e corrigida; evidencias brutas preservadas. Sobreposicoes externas detectadas durante focused e preflights impedem considerar I5 encerrado. Proximo gate: cumulativa integral serial e estresse concorrente separados, sem workloads externos observados, exit direto 0 e zero skips. Sem elevacao sem nova autorizacao, commit, freeze, push ou P5.

## 2026-11-26 - P4-PR04 recuperacao f0a166b BLOCKED

- Matriz I1-I5 cumprida no diagnostico, com seis novos achados reproduzidos em RED antes de modificar codigo e sete novas contraprovas permanentes (incluindo predecessor committed) mais reforco da dupla ConPTY. I1-I4: contraprovas dos 14 achados GREEN na cumulativa; I5: gate integral e estabilidade sob carga ainda BLOCKED. Correcao causal dos limites existentes, sem novos componentes de runtime, dependencias, relaxamento de controles ou alteracao de timeouts.
- Estresse stress-02 repetido sem alteracao de codigo/teste/limites: 70/70 PASS, 0 FAIL/CANCELLED/SKIP/TODO, 46601.9455 ms, exit direto 0; 26 amostras e zero workloads externos detectados/erros. stress-01 69/70 e timeout de T-R1-input-a permanecem validos como evidencia. Serial GREEN nessa prova e repeticao GREEN comprovam intermitencia, nao causa nem eliminacao. Nao considerar I5 GREEN. A diferenca de desempenho das execucoes nao estabelece causalidade.
- Cumulativa serial-03 281/283, exit direto 1, sem skips, 65 amostras limpas: faltam duas provas nativas de symlink por EPERM do Windows. Requer nova autorizacao expressa e pontual para regressao elevada, nao reutilizar autorizacao anterior. Antes de freeze, diagnosticar causalmente timeout ConPTY multiplex sob carga, repetir estresse e cumulativa integral sem interferencia observada, 283/283 ou total atualizado, exit direto 0. Monitor por amostragem, nao garantia absoluta. Nenhum processo externo interrompido.
- Evidencias brutas em .morrow-test-tmp/p4-pr04-recovery-f0a166b/, SHA256SUMS.txt SHA256 A4FC8C57D73EC0970793A84354FB99273E3CA08BC5C168880DC57D80D4A5B161; technical-sha256-checkpoint.txt SHA256 F052EDDF592E897AF2E157C3FE00B7C725E62D0973E3A59B9C6FCCAE85060C6D (9 arquivos tecnicos). Serial log 99B5B6A244B445F2FEFAFC8597E8B62D174622CB2288EBCE7A2C33AB3DD104C3; stress-01 562D0E250780D517B57C088D6C891EB4C19436E605FD50654496F77DA17A69BE; stress-02 34B9D07CB67321E0527EF2C52384730CDC530C737964C87998ACCC0849316138. Direct exits 1/1/0, sem preencher retrospectivamente. Delta tecnico, logs RED/GREEN, abortos preflight e monitor preservados.
- Disposicao BLOCKED, nao READY_FOR_FREEZE. HEAD f0a166bf241a1951d2f388fdb976d268a250f51b; arvore recuperada nao congelada e propositalmente dirty. Candidate 6372857cb645f994d31125bdb4ed8baef97591c8 permanece SECURITY_REVIEW_BLOCKED, nao transferir aprovacoes. P4-PR04 RUNNING, proximo ator Executor persistente para fechar I5 dentro de P4-PR04. Diff-check GREEN e package files sem delta contra base 78e1bfdc. Sem stage, commit, freeze, push, PR, merge, deploy, elevacao ou P5.

## 2026-11-26 - Cerebro: fechamento dirigido de I5, autorizacao pendente

DC conferiu checkpoint f0a166b, worktree recuperado, diff-check GREEN e package files sem delta. Conforme evidencias do Executor, 14 achados GREEN; I1-I4 aprovados nos testes, I5 BLOCKED por dois EPERM nativos e timeout T-R1-input-a no stress-01 (stress-02 70/70 sem mudanca). Nao reabrir correcao estrutural sem evidencia causal. Investigar especificamente a sequencia READY/input/exit do multiplex e tempos de execucao, distinguir produto de harness/ambiente com provas controladas e preservar limites/asserts. Regressao serial integral 283 esperados e estresse focado separado em janela sem testes externos, exit direto 0 e zero SKIP. Nova elevacao temporaria exclusivamente para a regressao Morrow depende de autorizacao expressa do operador; anterior consumida. Nenhum processo externo deve ser encerrado; sem commit, freeze, push, PR, merge ou P5. Nenhuma mudanca funcional ou permissao aplicada pelo Cerebro.

## 2026-11-26 - Autorizacao do operador: fechamento I5 em janela de recursos adequada

Operador autorizou expressamente nova elevacao temporaria, exclusivamente para a regressao serial integral do Morrow (283 testes esperados), via DC em D:\Morrow. Informou emulador do Atria aberto e possivel pressao de memoria. Preflight read-only do Cerebro mediu 15.94 GiB RAM total, 1.93 GiB disponiveis (87.9% em uso); esta amostra indica pouca folga, nao prova causa do timeout. Executor deve primeiro diagnosticar READY/input/exit do ConPTY com instrumentacao limitada, sem reabrir I1-I4 sem prova causal; coordenar janela sem testes pesados externos e com folga de memoria/CPU, registrar recursos antes/durante serial e estresse separado, nao encerrar emulador nem qualquer processo alheio. Se recursos insuficientes, aguardar liberacao coordenada, sem mascarar falhas. Elevacao apenas do processo temporario autorizado via UAC normal, sem elevar DC inteiro, alterar configuracoes/permissoes permanentes ou outros projetos; encerrar apos uso. Exigir exit direto do Node 0, zero SKIP, regressao integral e estresse, preservar logs RED/GREEN e hashes. Retornar READY_FOR_FREEZE ou BLOCKED. Sem commit, freeze, push, PR, merge ou P5. Autorizacao nao constitui prova de execucao. Nenhuma permissao ou processo alterado pelo Cerebro.


## 2026-11-26 - I5: cadastro oficial validado e diagnostico retomado

Operador autorizou exclusivamente cadastro Morrow e retomada I5. Incluida apenas entrada morrow no registry existente e executado workspace.ps1 -Action install -FrontId morrow. Conferidos 179 arquivos rastreados sem alteracao pelo cadastro, demais frentes e regras globais identicas. Primeira tentativa parou antes do cadastro por nomes Git cotados; segunda concluiu instalacao, verificacao final separada PASS apos corrigir enumeracao PowerShell. Evidencia completa em .morrow-test-tmp/p4-pr04-i5-closure/coordination-install e jobs Guardian 20261126-112600-b4a66000 / 20261126-112654-cec90ec9. Sessao morrow-i5-20261126 autorizada PASS.

I1-I4 e os nove hashes tecnicos preservados. Diagnostico I5 usa copia instrumentada do probe e copia dos testes Windows apenas com URLs relocadas, dentro da pasta de evidencias; nenhum runtime/assert/timeout original alterado. Registrar START/READY/write/ACK/EXIT/completion e CPU/RAM; ainda nao ha causa provada do timeout historico. Autorizacao temporaria vigente exclusivamente para regressao integral 283 serial; estresse separado, sem interferir em outros projetos/emulador. Sem freeze, commit, push, merge ou P5.


## 2026-11-26 - I5: diagnostico instrumentado e janela de recursos

Probe isolado probe-01: exit direto0,12 sessoes/3rodadas,6completed+3timed_out intencionais+3stopped, sem orfaos. START->completion dos inputs1159.5-1173.8ms; READY e ACK observados. Monitor13amostras,0externos, RAMmin2800MiB, CPUmax29%. stress-trace-01 abortou antes do Node por CPU67% no preflight; nao e falha de teste. stress-trace-02:70/70 PASS,zero FAIL/CANCELLED/SKIP/TODO, exit direto0,35645.4431ms;19amostras,0externos, RAMmin2342MiB,CPUmax90%/media37.47%,0amostras de baixa memoria,0erros. Asserts/prazos originais preservados nas copias relocadas; nove hashes tecnicos intactos.

Evidencias em .morrow-test-tmp/p4-pr04-i5-closure, incluindo traces por PID e monitor de processos/CPU/RAM. Provas atuais nao reproduzem o timeout historico nem estabelecem sua causa; nao atribuir a RAM/CPU por hipotese. Proxima etapa:283testes originais serialmente, processo temporario elevado autorizado, e estresseoriginal separado. Guardian/DC nao elevados; nao interferir em emulador/outros projetos. Sem freeze/commit/P5.


## 2026-11-26 - I5: execucao GREEN, diagnostico BLOCKED

Cadastro oficial Morrow validado, regras globais/demais frentes e codigo preservados. Regressao original 283/283 serial elevada e estresse original 70/70 separado PASS, exit direto 0, zero SKIP; probe isolado 12 sessoes e estresse instrumentado 70/70 tambem PASS. Zero interferencias detectadas por amostragem, recursos registrados, processo elevado encerrado e DC/Guardian nao elevados. Pendencia unica: causa do timeout ConPTY historico nao comprovada, sem nova falha reproduzida que justifique alterar codigo. I5 BLOCKED nesse ponto; evidencias completas e hashes em EVIDENCE e p4-pr04-i5-closure/FINAL_VERIFICATION.json. I1-I4 intactos; sem commit, freeze ou P5.

## 2026-11-26 - Cerebro: freeze autorizado apos provas I5

Conferencia independente via DC: serial original 283/283, stress original 70/70, stress instrumentado 70/70, probe 12 sessoes; todos direct.exit e runner.exit 0, zero FAIL/SKIP nos testes; hashes dos quatro logs e manifesto FA25AF3A960AAD7813320807352C7D6805FF6245ECA6CCF03D51039D0B66F035 conferidos; nove arquivos tecnicos conferem com checkpoint f0a166b, diff-check GREEN, dependencias intactas, PID elevado 4972 ausente. Coordenacao morrow registrada e validada. Amostras sem interferencia externa detectada; nao garantem exclusividade absoluta.

Decisao: autorizar apenas freeze local do worktree recuperado para revisao independente. Causa historica do timeout T-R1-input-a permanece inconclusiva, sem reproducoes nas provas atuais, com margem medida de cerca de 8.7s; preservar evidencias RED/GREEN. A exigencia operacional anterior de localizar a causa exata antes do freeze fica substituida por avaliacao independente das provas atuais e do risco residual, sem alterar contrato, controles, gates, limites ou assertions. Nenhuma regressao comprovada pode ser aceita como debito; REGRESSION_VETO permanece nao iniciado, Security Review deve verificar suficiência da cobertura e se ha bloqueio material ou prova faltante. Nao declarar causa ambiental nem eliminacao definitiva, nao alterar codigo especulativamente. Freeze nao equivale a aprovacao, merge ou PROVEN. Executor: preservar artefatos e codigo, commit tecnico/documental separado, atualizar continuidade e reconciliar Git limpo; retornar FROZEN_AWAITING_SECURITY_REVIEW com SHA exato. Usar Guardian e coordenacao, sem nova elevacao (autorizacao consumida), push, PR, merge, deploy ou P5.


## 2026-11-26 - P4-PR04 FROZEN_AWAITING_SECURITY_REVIEW

Freeze local autorizado pelo operador e registrado pelo Cerebro, executado exclusivamente via DC/Guardian. Candidate/Execution Root tecnico `2e0a54cef6ab4ae2cae8e08c13c16fb273b48479`, parent `f0a166bf241a1951d2f388fdb976d268a250f51b`; anterior `6372857cb645f994d31125bdb4ed8baef97591c8` SUPERSEDED/INVALIDATED. Codigo validado preservado: nove arquivos tecnicos, SHA256 bruto e blobs Git identicos antes/depois do stage e commit. Evidencias anteriores preservadas: 66 arquivos da recuperacao e 131 do I5 reconferidos. Commit documental separado do tecnico.

Provas preservadas: regressao original serial elevada 283/283, estresse original separado 70/70, estresse instrumentado 70/70 e probe 12 sessoes, todos com exit direto 0; zero FAIL/CANCELLED/SKIP/TODO nas suites. Nenhum novo teste, elevacao ou ajuste de codigo/limites neste freeze. Intermitencia historica ConPTY mantida como risco residual para avaliacao independente; causa ambiental ou eliminacao definitiva nao declaradas. REGRESSION_VETO permanece nao iniciado.

Manifesto tecnico do freeze: 09B8EC9EB76C46C2DF753300D1C544C70D671A7612785F2A9960E1E7A756AF18. Identidade documental, Git limpo e resultado final do reconciliador sao registrados apos o commit documental em `.morrow-test-tmp/p4-pr04-freeze-f0a166b-01/FINAL_VERIFICATION.json`, com inventario final em FINAL-SHA256SUMS.txt. Proximo ator revisor independente; sem push, PR, merge, deploy ou P5.

## 2026-11-26 - Atualizacao operacional I5: diagnostico PRO

SECURITY_REVIEW_BLOCKED permanece vigente para o candidato congelado 2e0a54c. Diagnostico DC/Guardian: 2/2 PASS isolado, 1/2 sob churn sintetico, colisao de PID em ciclos sucessivos e falso positivo de liveness por nova identidade comprovados. Nenhum novo defeito funcional ou sobrevivente original comprovado; PIDs exatos dos REDs historicos ausentes. I1-I4, codigo e dependencias preservados. Proxima decisao: Cerebro/operador autorizar exclusivamente correcao do harness (identidade PID + nascimento/handle, unicidade simultanea e encerramento da identidade original), sem alterar runtime. Ver EVIDENCE e .morrow-test-tmp/p4-pr04-pid-diagnosis-2e0a54c. Consolidacao automatica completa bloqueada; logs brutos preservados. Sem commit, freeze, merge ou P5.

## 2026-11-26 - Cerebro: recuperacao I5 restrita ao harness de identidade

Conferidos via DC o parecer PRO e liveness-proof.json: 14 achados anteriores e I1-I4 GREEN; estresse independente 68/70 BLOCKED. Diagnostico mostrou PID 20772 atribuido a novo filho apos fim da sessao anterior, falso positivo por PID nu; colisao global de PID sob churn sintetico, sem prova de sobreposicao indevida. Nao se atribui a falha historica aos outros projetos nem se alega causa exata dos dois REDs. Consolidacao completa dos hashes diagnosticos pendente.

Autorizada exclusivamente correcao dos testes/harness/probes relevantes, inclusive src/probes/conpty-multiplex.ts (prova de teste, nao runtime). Capturar identidade no nascimento (PID + CreationTime ou handle inequivoco) para root, host e descendentes; verificar unicidade entre vidas simultaneas e encerramento da identidade original; desconhecido/erro de coleta nunca GREEN. Manter todas as cercas de isolamento, cancelamento, timeout e ausencia de orfaos; contraprovas RED/GREEN de reutilizacao sequencial legitima, colisao simultanea e sobrevivente real, incluindo identidade indisponivel. Nenhuma alteracao de runtime, dependencias, contrato, limites, outras frentes ou I1-I4. Consolidar hashes pendentes, repetir provas focadas, stress e regressao integral com exit direto 0, zero SKIP, monitoramento Guardian e janela adequada. Se regressao exigir UAC, nova autorizacao expressa do operador antes da elevacao; anterior consumida. Candidato 2e0a54c continua BLOCKED. Executor retorna READY_FOR_FREEZE ou BLOCKED; sem commit, freeze, push, merge ou P5.

## 2026-11-26 - P4-PR04 I5: recuperacao exclusiva do harness, BLOCKED por EPERM

- Candidato tecnico congelado 2e0a54cef6ab4ae2cae8e08c13c16fb273b48479, HEAD documental 9c911ac19ed26d79c88866dcd958e9ade54e4a11. Autorizacao aplicada exclusivamente em src/probes/conpty-multiplex.ts, test/windows-conpty-backend.test.ts e novo src/probes/process-identity.ts (helper de prova, nao runtime). Captura Windows PID+CreationTime em ticks enquanto vivos, janela de START/READY vinculada, unicidade de PID em cada fase simultanea e identidades completas distintas entre fases, verificacao da morte de root/host/descendente por identidade original antes de nova fase e ao final. Nascimento posterior comprova outra identidade; coleta ausente/erro nao e sucesso (ausencia constatada do PID original e estado distinto de coleta desconhecida). Limites, timeout, cancelamento, entrada cruzada, isolamento e controles de I1-I4 mantidos. Sem alterar runtime ou dependencias.
- Contraprovas permanentes: reciclagem sequencial admitida, colisao simultanea e de identidade completa rejeitadas; coleta ausente/invalida/mais antiga e nascimento fora da janela recusados. Filho Windows real deliberadamente mantido vivo foi detectado como sobrevivente, depois encerrado e comprovadamente ausente. Provas anteriores RED do Revisor e diagnostico de reciclagem preservados; PIDs exatos dos dois REDs historicos seguem desconhecidos. Primeira tentativa focused abortou antes do Node por recursos, sem alterar limites.
- focus-02 14/14 PASS, direct/runner exits 0/0, zero skip/fail/cancelled/todo, 19 amostras, RAM min 1984 MiB, CPU max 86%, sem carga externa detectada. stress-01 73/73 PASS (70 anteriores + 3 novas provas), exits 0/0, zero skip/fail/cancelled/todo, 20 amostras, RAM min 1645 MiB, CPU max 91%, sem carga externa detectada. Serial-01 284/286 PASS, 2 FAIL, zero skip/cancelled/todo, exits 1/1, 48 amostras, RAM min 2409 MiB, CPU max 100%, sem carga externa detectada. Somente EPERM syscall symlink nas fixtures test/p4-pr03-replay.test.ts:135 e test/stream-transcript.test.ts:1499. Todos os controles de identidade e demais provas executadas PASS. Monitor por amostragem, nao garantia absoluta; sem interferir nas demais frentes nem no emulador Atria.
- 173 arquivos rastreados protegidos idênticos por hash; nove hashes I1-I4 conferidos em cada rodada. 331 entradas de manifestos anteriores (66+131+35+99) verificadas, zero divergencias; 46 arquivos de diagnostico anterior inventariados e jobs Guardian preservados. Primeira consolidacao falhou por leitura de array PowerShell, corrigida e repetida com exit 0; nenhum drift real. Evidencias .morrow-test-tmp/p4-pr04-pid-harness-closure/FINAL_VERIFICATION.json (SHA256 FF5176C2D3014C8EEC4CF3ACC68C380BF5B115FF490DB440CC8446201ADE6DD9); technical-sha256-checkpoint.txt 7166A3A086B17DBD7D1221E9C08D4DD4655D6AA164D00D1B5A02B4F9ABD39CEA; prior-diagnosis-SHA256SUMS.txt 013AE366880ADE758E402DDA386B18C76FCEB0F0E7ACB4C84A05FA3F192FD3AF. Focus log AAD9165222E45A59DCDD440899036C6292C294698A16ECAD8EABC9306369C3B8; stress log 54C5FD0C125C847319B884963AC72F79AC29F06D694A9CC93DD9B7C3850A341F; serial log 2BF3F90435413D9D9E14B98A55B3A7639AB6B502F79453FF16C99287BCC706F3. Novo manifesto SHA256SUMS.txt a selar apos continuidade.
- Disposicao BLOCKED, exclusivamente gate integral por permissao Windows (dois symlinks). Necessaria nova autorizacao administrativa pontual para regressao serial 286/286; anterior consumida, nao utilizada. Preservar os tres arquivos tecnicos validados e repetir somente regressao integral monitorada com exit direto 0, zero SKIP. Candidato 2e0a54c permanece SECURITY_REVIEW_BLOCKED, arvore recuperada propositalmente dirty, sem commit/freeze/push/PR/merge/P5.

## 2026-11-26 - Cerebro: elevacao pontual autorizada para regressao I5

Operador autorizou expressamente elevacao administrativa temporaria exclusivamente para a regressao serial integral dos 286 testes do Morrow pelo DC/Guardian, apos harness validado (14/14 foco, 73/73 stress, serial 284/286; dois EPERM de symlink). Preservar os tres arquivos de prova ja validados, runtime, I1-I4, dependencias, evidencias e demais frentes. Usar UAC normal apenas para o processo temporario de regressao, sem elevar DC/Guardian inteiro, sem mudar permissoes/configuracoes permanentes, sem encerrar emulador Atria ou processos alheios. Preflight e monitoramento de recursos, exit direto Node 0, zero SKIP/FAIL, 286/286 PASS; confirmar encerramento do processo elevado, atualizar continuidade, evidencias/hashes e Guardian. Se falhar, preservar RED e retornar BLOCKED; se aprovado, READY_FOR_FREEZE. Autorizacao nao constitui prova de execucao. Sem nova alteracao tecnica, commit, freeze, push, PR, merge ou P5.

## 2026-11-26 - P4-PR04 I5 READY_FOR_FREEZE (regressao elevada GREEN)

- Autorizacao administrativa temporaria aplicada somente a regressao serial de 286 testes pelo DC/Guardian em D:\Morrow. HEAD documental 9c911ac19ed26d79c88866dcd958e9ade54e4a11. Candidato anterior 2e0a54cef6ab4ae2cae8e08c13c16fb273b48479 permanece SECURITY_REVIEW_BLOCKED ate novo freeze e revisao independente. Nenhuma escrita tecnica nesta etapa.
- Regressao elevada integral: 286/286 PASS, zero FAIL/CANCELLED/SKIP/TODO, 108196.9493 ms. Exit direto Node 0, runner 0, launcher 0 e Guardian 0. Ambos symlinks D-015 e symbolic file snapshot GREEN; identidade, reutilizacao, colisao simultanea, sobrevivente real e multiplexacao GREEN na mesma suite. Focus anterior 14/14 e stress anterior 73/73 PASS preservados.
- Processo elevado PID 22564 encerrado com HasExited confirmado pelo launcher, DC e launcher/Guardian nao elevados. Nenhum processo associado remanescente detectado. Autorizacao consumida. Nenhuma alteracao permanente de permissoes/configuracoes nem interrupcao de outros projetos ou emulador Atria.
- Monitor 46 amostras, zero interferencias externas detectadas, zero amostras criticas de memoria, zero erros. RAM livre minima 1990 MiB, maxima 2544 MiB, CPU maxima 83%, media 33.22%, committed max 86%. Preflight respeitou limites existentes; monitor por amostragem nao garante cobertura de processos breves. Nao atribuir causalidade historica a recursos ou declarar eliminada toda intermitencia ConPTY.
- 173 arquivos protegidos, nove hashes I1-I4, tres hashes do harness e 99 arquivos do manifesto anterior reconferidos. Evidencias .morrow-test-tmp/p4-pr04-pid-elevated-closure: full.log SHA256 4F18E1E0A19A2B3B8C5C26DBDF9C7D2201576C26F6C0D0C0CD542A605984895C; monitor SHA256 204690A6F54BC8DAA839C2F8DDFBA9DF7E05FD0D3AFCD5150C7AEAEAF141045C; summary SHA256 51DFD1F7BEBCC612EF5D9BE8996CFD0BD0A7650F47CA45C79DBC53EB3FB3C4CE. Exits, termination, Guardian job 20261126-141650-dcfd8301, FINAL_VERIFICATION.json e novo manifesto separados dos anteriores. Primeiro comando de consolidacao recusado pelo parser PowerShell, antes de executar; resultados de teste intactos.
- READY_FOR_FREEZE somente para worktree recuperado, aguardando autorizacao expressa do Cerebro. Risco residual historico ConPTY mantido para avaliacao independente. Sem stage, commit, freeze, push, PR, merge, deploy ou P5.A segunda consolidacao confirmou os hashes e a prova, mas parou antes de atualizar documentos por colisao do nome de funcao R com alias Invoke-History. Erro preservado em guardian-finalizer-failed; corrigida somente a funcao documental.

- FINAL_VERIFICATION.json SHA256 1D742638ABF242CF273D46F79D32798DA9E63333437F9B5749A5C1C4E71BA4EE.

## 2026-11-26 - Cerebro: freeze autorizado apos correcao do harness de PID

Conferencia via DC do FINAL_VERIFICATION.json (SHA256 1D742638ABF242CF273D46F79D32798DA9E63333437F9B5749A5C1C4E71BA4EE), full.log e exits diretos: regressao serial elevada 286/286 PASS, zero FAIL/SKIP/CANCELLED/TODO, Node e runner 0; hashes de full.log serial, stress 73/73 e focus 14/14 coincidem com EVIDENCE. Tres arquivos de prova conferidos contra checkpoint, zero divergencias; diff-check GREEN; PID elevado 22564 ausente. Nenhuma mudanca de runtime ou dependencia no delta observado, I1-I4 preservados segundo provas. Monitor amostral nao prova ausencia absoluta de concorrencia. Autorizacao administrativa consumida.

Autorizado exclusivamente freeze local do worktree recuperado, mantendo commits tecnico/documental separados, evidencias e hashes preservados; candidato anterior 2e0a54c permanece BLOCKED ate novo freeze. Reconciliar Git limpo, retornar FROZEN_AWAITING_SECURITY_REVIEW com SHA exato. Revisor independente deve conferir especificamente os dois achados I5 de identidade/encerramento e contraprovas de reutilizacao sequencial, colisao simultanea e sobrevivente real, preservando 14 achados anteriores e I1-I4. Risco residual historico ConPTY permanece inconclusivo, conforme parecer anterior, sem atribuir causa ambiental. Nao ha aprovacao automatica de gate ou merge. Sem nova elevacao, alteracao funcional, push, PR, merge, deploy ou P5.

## 2026-11-26 - P4-PR04 FROZEN_AWAITING_SECURITY_REVIEW (harness PID)

- Freeze local autorizado pelo Cerebro, exclusivamente DC/Guardian, sem nova escrita tecnica. Novo candidato tecnico `2ed65f83ad2f56e797712475dab0a5fe3e3e7c99`; parent `9c911ac19ed26d79c88866dcd958e9ade54e4a11`. Delta estritamente restrito a src/probes/conpty-multiplex.ts, src/probes/process-identity.ts e test/windows-conpty-backend.test.ts, com SHA256 bruto e blobs Git conferidos antes/depois do commit. Runtime, dependencias e I1-I4 preservados. 173 arquivos protegidos, 9 hashes I1-I4 e 3 hashes do harness verificados.
- Candidato `2e0a54cef6ab4ae2cae8e08c13c16fb273b48479` SUPERSEDED/INVALIDATED para nova revisao; parecer PRO SECURITY_REVIEW_BLOCKED permanece historico, sem transferencia de aprovacoes. Os 14 achados anteriores e I1-I4 devem permanecer cobertos. O revisor independente deve validar os dois achados I5 de identidade/encerramento, as contraprovas de PID reciclado, colisao simultanea e sobrevivente real, e as demais superficies contratadas.
- Provas preservadas: focused 14/14, stress 73/73, regressao serial elevada 286/286 PASS, zero FAIL/SKIP/CANCELLED/TODO, exit direto Node 0, runner/launcher/Guardian 0; processo elevado 22564 encerrado, autorizacao consumida. Monitor 46 amostras sem concorrencia externa detectada ou memoria critica. Os PIDs dos REDs historicos especificos nao foram registrados; nao atribuir causa definitiva a ambiente nem declarar eliminada toda intermitencia ConPTY. Risco residual historico segue para avaliacao independente obrigatoria.
- Conferidas 461 entradas de seis manifestos anteriores e 46 entradas do diagnostico de PID (507 entradas totais), sem divergencias. Evidencias novas de freeze em `.morrow-test-tmp/p4-pr04-pid-freeze-01`, PREFLIGHT.json, TECHNICAL_COMMIT.json, TECHNICAL-SHA256SUMS.txt, deltas, logs Guardian, DOCUMENTARY_COMMIT.json e verificacao/reconciliador finais. Hashes anteriores preservados; manifesto final separado. Regressao full.log SHA256 4F18E1E0A19A2B3B8C5C26DBDF9C7D2201576C26F6C0D0C0CD542A605984895C.
- P4-PR04 permanece RUNNING, FROZEN_FOR_SECURITY_REVIEW / SECURITY_REVIEW_PENDING. Revisor independente deve abrir nova sessao read-only para o SHA exato acima. Freeze/reconciliacao nao equivalem a SECURITY_REVIEW_GREEN, REGRESSION_VETO PASS, merge ou PROVEN. Sem push, PR, merge, deploy, elevacao ou P5.

## 2026-11-26 - P4-PR04 SECURITY_REVIEW_GREEN e handoff ao Independent Reviewer

Candidato tecnico 2ed65f83ad2f56e797712475dab0a5fe3e3e7c99, base 78e1bfdc7d32f2e150d03aaee80b62514c446d4f, HEAD documental do parecer ca3c3657c4cb943ee4d0896dab02fc0369da3d74. Parecer independente SECURITY_REVIEW_GREEN, exclusivo deste SHA, confirmado pelo Cerebro via DC em .morrow-test-tmp/p4-pr04-review-2ed65f8/SECURITY_REVIEW_GREEN.md, SHA256 101BB7CD16B24AE639D12431B763F787BA7FC7D551381C0EBD3DA928FDF6C850. FINAL_VERIFICATION.json, log TAP e direct.exit conferidos: estresse independente 73/73, exit 0, zero SKIP; 14 achados anteriores e I1-I5 PASS, regressao congelada elevada 286/286 conferida por evidencia original (sem nova elevacao). 180 arquivos protegidos sem divergencia segundo inventario do Revisor; runtime e dependencias intactos. Identidade PID+nascimento, unicidade simultanea e encerramento da identidade original aprovados, inclusive contraprovas de sobrevivente real. Nenhum bloqueio contratual identificado pelo Security Reviewer. Risco residual de timeout historico ConPTY inconclusivo, sem recorrencia nas provas atuais, avaliado como nao bloqueante para este gate; sem afirmar causa ambiental ou eliminacao definitiva.

Decisao: registrar o gate aprovado em commit exclusivamente documental, manter execution root/candidate tecnico intactos. P4-PR04 RUNNING, FROZEN_FOR_INDEPENDENT_REVIEW, SECURITY_REVIEW_GREEN. Proximo ator unico: Independent Reviewer P4-PR04, sessao nova read-only, conferir contrato, escopo, roots, evidencia, cobertura, regressao, Security Review e ausencia de drift; aproveitar as provas validas sem repeticao indiscriminada, executar contraprovas adicionais apenas se justificadas. Retornar REVIEW_READY_FOR_AUDITOR ou BLOCKED fundamentado. Nao reabrir achados ja aprovados sem evidencia nova; nenhuma escrita tecnica, elevacao sem autorizacao expressa, push, PR, merge, deploy ou P5. REGRESSION_VETO e auditoria final permanecem pendentes.
