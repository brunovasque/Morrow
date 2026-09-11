# Estado vivo — MORROW-MVO-001

## Snapshot atual

- `snapshot_version`: `1.0`
- `updated_at`: `2026-09-11`
- `contract_version`: `1.0`
- `effective_addenda`: `A-001`
- `contract_state`: `READY_FOR_EXECUTION`
- `target_id`: `morrow-core`
- `integration_branch`: `phase-2/runtime-v0`
- `proven_baseline_sha`: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`
- `active_phase`: `P4`
- `active_pr_id`: `P4-PR03`
- `active_route_node`: `REPLAY_REHYDRATION_CURSORS_LIVENESS`
- `active_subaction`: `P4_PR03_PR_IDENTITY_VERSIONED`
- `expected_branch_prefix`: `mvo/p4-pr03-`
- `write_execution_allowed`: `no for integration/merge; START is coarse and not merge authorization`
- `next_authorized_action`: `START_P4_PR03`
- `next_authorized_actor`: `mesmo Integrator persistente, somente para push fast-forward do novo Control Root documental, confirmação da identidade/remote head da PR #21 e gates pós-PR; merge permanece proibido`
- `execution_root_sha`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`
- `opening_control_root_sha`: `de47fd7a3f919a7094a16c051548cef0a47bf51a`
- `pr_identity_state`: `PR_IDENTITY_VERSIONED`
- `pr_number`: `21`
- `pr_head_sha_at_opening`: `de47fd7a3f919a7094a16c051548cef0a47bf51a`
- `pr_base_sha_at_opening`: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`
- `pr_state_at_opening`: `OPEN; não draft; mergeable`
- `merge_authorized`: `no`

## Próxima ação exata

P4-PR02 está `PROVEN` após o merge commit `3738d7877cc1613e363adee8063322eefb595528` da PR #18, com Auditor pré-merge `MERGE_READY`, regressão pós-merge verde e Auditor final `P4_PR02_PROVEN_READY`. A closure-record foi integrada pela PR #19 no merge `a7f0f49efa630f927ac22f56d8cd0ce2032664cc`. P4-PR03 permanece `RUNNING`, com Execution Root `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`, Control Root de abertura/head `de47fd7a3f919a7094a16c051548cef0a47bf51a`, base de abertura `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc` e branch `mvo/p4-pr03-replay-rehydration`. Security, Reviewer e Auditor estão `GREEN`; a identidade está versionada como `PR_IDENTITY_VERSIONED` para o repositório `brunovasque/Morrow`, PR #21, URL `https://github.com/brunovasque/Morrow/pull/21`, contra `phase-2/runtime-v0`. O próximo ator é o mesmo Integrator persistente, somente para push fast-forward do novo Control Root documental, confirmar que a mesma PR #21 aponta para ele, executar/observar os gates pós-PR e retornar ao próximo gate; merge permanece proibido. `START_P4_PR03` permanece a ação coarse do reconciliador.

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
| P4 | `RUNNING` | P4-PR02 `PROVEN` em PR #18 / merge `3738d787`; closure-record da PR #19 integrada em `a7f0f49`; P4-PR03 `RUNNING` na branch `mvo/p4-pr03-replay-rehydration`, base `cd7113f`, rota replay/reidratação/cursor/liveness; P4-PR04 permanece fora de escopo |
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
