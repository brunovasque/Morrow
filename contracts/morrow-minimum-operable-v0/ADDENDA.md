# Adendos — MORROW-MVO-001

| addendum_id | requested_by | reason | original_clause | approved_change | impact_on_map | impact_on_regression | owner_approval | effective_at |
|---|---|---|---|---|---|---|---|---|
| `A-001` | Owner — Bruno Vasque | O serviço externo de Security Review exigido para P4-PR02 está indisponível | `TARGET.md`, Política de segurança: Security Review obrigatório para mudança que toca transcript | Exclusivamente para P4-PR02, substituir o gate externo indisponível por revisão local independente de segurança. O revisor e a sessão devem ser distintos do Executor; o checkout deve permanecer somente-leitura; cada ciclo fixa base/head antes da revisão. O primeiro ciclo cobriu `3657a070e5dc6b1e7b78fa1804761440c55efffc..79382d421a9a6e9df2956007fb701d32d00c5952`, encontrou um P2 de negação de serviço algorítmica e bloqueou integração. A correção autorizada gerou o candidate anterior `a44daee73ac6bb9b91523a947a6e0154397efcee`, que invalidou o parecer anterior e foi posteriormente superseded/invalidated pelo microfix de código `15e3ac733fc295d4cff3762de957f348a6e02c01`; o novo candidate deve ser revisto novamente contra a mesma base. Depois do candidate, somente documentos P4-PR02 da allowlist registrada podem mudar sem integrar o código candidato. O escopo é transcript/redaction; o relatório deve registrar cobertura, ferramenta, testes, achados, limites e veredito; qualquer P1/P2 bloqueia integração. A substituição não é equivalente ao serviço externo, não certifica as superfícies não medidas e não cria precedente para outra PR. | P4-PR02 permanece `RUNNING` e `BLOCKED ON A-001`; o microfix retorna a unidade à nova revisão local independente antes de merge/regressão pós-merge | Invalida o review do head anterior após qualquer correção; exige reexecução de desempenho, semântica fail-closed e regressão no candidate novo | `APPROVED` — autorização explícita do dono em 2026-09-02; retorno por P2 e correções autorizados em 2026-09-02 | 2026-09-02 |

## Regra

Alterar objetivo mestre, critério de aceitação, exclusão, envelope operacional ou invariante exige linha aprovada aqui. Correção de rota, ordem, tecnologia ou papel permanece no mapa/ADR quando o destino não muda.

## Estado factual atualizado — A-001 / P4-PR02

- A revisão local independente do candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` foi executada em nova sessão e ficou `BLOCKED` por um achado P2 de reconstrução via VT CSI `b` / REP.
- O Executor reproduziu o RED antes da correção, corrigiu o caminho fail-closed e criou o novo candidate `ba350658a39f270cbc9ec559c193997a1a0db047`.
- O candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` está `SUPERSEDED`/`INVALIDATED`. O novo candidate ainda não possui A-001 válido.
- P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge permanece proibido e P4-PR03 permanece não autorizada. O candidate `ba350658a39f270cbc9ec559c193997a1a0db047` está `SUPERSEDED`/`INVALIDATED` pelo candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`; o próximo ciclo deve usar base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e esse novo candidate.

## Estado factual atualizado — A-001 / P4-PR02 — terceiro ciclo

- O A-001 do candidate `ba350658a39f270cbc9ec559c193997a1a0db047` permanece `BLOCKED` por P2 de bypass de redaction via reconstrução HPA + DCH; o canário atravessou live, `inspect()` e `transcript-v1.json`. O diagnóstico estrutural confirmou que a classificação CSI anterior era insegura: o parser aceitava finais `0x40..0x7E`, enquanto a classificação usava reconhecimento restritivo e blacklist incompleta.
- O candidate `ba350658a39f270cbc9ec559c193997a1a0db047` foi superseded/invalidated pelo novo candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`, parent `c8bb6afda8640bc11b9b82d36d931374fd725153`, mensagem `fix(p4-pr02): fail closed on untrusted terminal controls`; o commit contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.
- A correção estrutural do novo candidate usa allowlist: somente SGR numérico comprovadamente inerte é descartado; demais CSI mutável, desconhecido ou não comprovado falha fechado, incluindo HPA, DCH, ICH, ECH, IL, DL, movimentos, REP, save/restore, queries, private modes, intermediários e finais válidos não alfabéticos. String controls completos OSC/APC/DCS/PM/SOS foram separados do classificador CSI e são consumidos/descartados em 7-bit e C1; incompletos continuam fail-closed. O efeito colateral 7-bit/C1 detectado antes do commit foi corrigido antes do congelamento do candidate.
- Provas finais independentes do candidate real: focused `31/31` GREEN; `npm run probe:conpty-soak` GREEN com 3 rodadas, 12 sessões, 6 completas, 3 timeouts, 3 stops, 12 recusas de colisão, 12 PIDs root/descendant/native-host distintos, `inputIsolation: true`, `noOrphans: true` e fixture removida; `npm test` `203/203` GREEN; `git diff --check` GREEN. Nenhum código ConPTY/P3 foi alterado.
- `D-013` permanece `OPEN_DEBT`: o controle passou, mas o débito histórico/intermitência não foi corrigido nem ocultado. O novo candidate ainda não possui A-001 válido; P4-PR02 continua `RUNNING` / `BLOCKED ON A-001`; merge permanece proibido, P4-PR03 não é autorizada e o próximo ator é Security Reviewer independente, nova sessão Luna xhigh, revisando o delta completo da base até `dc0bbaf`.

## Estado factual atualizado — A-001 / P4-PR02 — quarto ciclo documental

- O candidate anterior `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf` foi posteriormente `SUPERSEDED`/`INVALIDATED`, antes de um novo A-001 sobre ele, após contraprovas adicionais encontrarem superfícies ainda não cobertas. Não houve novo A-001 sobre `dc0bbaf`.
- O Executor reproduziu REDs para opção CLI sensível; assignment JSON com whitespace multiline antes do separador; custo superlinear ao receber string-control incompleto fragmentado; e tratamento incorreto de terminador C1 em OSC, causando over-redaction.
- As causas diagnosticadas foram: boundary genérico que não reconhecia chave sensível após opção CLI; whitespace anterior ao separador que não aceitava CR/LF; `release()` que reprocessava o `pending` crescente; e `terminalOscEnd()` que não reconhecia C1-ST.
- A correção implementada no novo candidate faz reconhecimento estrutural de opções CLI sensíveis; aceita whitespace estrutural multiline antes do separador; usa scanner incremental bounded de terminal/string-control entre chunks; reconhece C1-ST em OSC; e preserva as cercas CSI/VT estruturais já presentes.
- O novo candidate de código é `95e808294395449b46438b799c0b7d480cece52d`, parent `84f095d87b6f3852d736f8cb11bbfa2d56efd2d6`, e contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.
- Provas do Executor: focused `35/35` GREEN; primeira regressão completa `206/207`, com a única falha correspondente ao histórico `D-013`; `npm run probe:conpty-soak` posteriormente GREEN, com 12 sessões, PIDs distintos, `noOrphans: true` e fixture removida; reexecução completa `207/207` GREEN; `git diff --check` GREEN. As medições reportadas para string-control incompleto caíram de ordem de segundos para poucos milissegundos no mesmo envelope de `4k/8k/12k/16k`.
- `D-013` permanece aberto e não foi corrigido, escondido ou alterado; não houve alteração de ConPTY/P3, push, merge ou deploy. O novo candidate ainda não possui A-001 válido; P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido e P4-PR03 continua não autorizada.
- O próximo ator é Security Reviewer independente, em nova sessão, Luna `xhigh`, read-only, revisando o diff completo `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`.

## Estado factual atualizado — A-001 / P4-PR02 — quinto ciclo

- O A-001 do candidate `95e808294395449b46438b799c0b7d480cece52d` foi efetivamente executado por Security Reviewer independente, nova sessão Luna `xhigh`, sobre o diff completo `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`, e ficou `BLOCKED`.
- Achado P2 — controle C1 stateful: um controle C1 não reconhecido podia alterar a apresentação visual; o normalizador descartava controles C1 não tratados genericamente; isso permitia reconstrução visual de chave sensível, atravessando live, `inspect()` e snapshot persistido.
- Achado P2 — custo superlinear sob fragmentação: `push()` continuava levando `release()` a recalcular `#ranges()` sobre `pending`; com chunks de 1 byte, o Reviewer mediu aproximadamente 1.024 bytes/82 ms, 2.048/255 ms, 4.096/957 ms, 8.192/2.633 ms e 16.384/6.014 ms; assignments chegaram a aproximadamente 4.292 ms em 8.192 bytes. O comportamento foi classificado P2 de disponibilidade.
- Provas do Reviewer: focused `35/35` GREEN; primeira `npm test` `207/207`; `npm run probe:conpty-soak` posteriormente falhou somente em `D-013`; segunda `npm test` `206/207`, com a única falha também em `D-013`; transcript/redaction permaneceu verde; `git diff --check` GREEN; worktree final limpa.
- O candidate `95e808294395449b46438b799c0b7d480cece52d` está agora `SUPERSEDED` / `INVALIDATED`; seu A-001 foi efetivamente executado e ficou `BLOCKED`, portanto não pode ser usado como prova de integração.

## Correção posterior — candidate de código `189c1ce`

- O novo Executor reproduziu os dois P2 e corrigiu as duas classes. Em C0/C1, fechou estruturalmente a classificação: somente controles comprovadamente textualmente inertes permanecem descartáveis; controles stateful, cursor/linha/tabulação/display/charset/flow-control/reservados ou desconhecidos passam a fail-closed. CSI/SGR, string-controls, backspace e CRLF permanecem nas rotas específicas já existentes.
- Na fragmentação, confirmou que, depois de cruzar o holdback, o remainder permanecia próximo de 4096 bytes e cada novo byte podia provocar novo scan dessa janela. O primeiro cruzamento continua sendo redigido normalmente; scans seguintes passam a ser amortizados/batched; newline força reavaliação para preservar fronteiras estruturais; `finish()` continua executando classificação final; `pending` continua bounded e nenhuma liberação ignora o redactor.
- O candidate atual é `189c1ced569489508ceb7d052f5e2b521cf085dd`, parent `b1a3bdedf2d6131702661403bf31251761e8602a`, mensagem `fix(p4-pr02): harden terminal controls and amortize stream scans`, contendo somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.
- Provas do novo candidate: focused `39/39` GREEN; `npm test` `211/211` GREEN; `D-013` não apareceu nessa execução; `git diff --check` GREEN. Conferência externa independente anterior ao commit confirmou fragmentação de 1 byte rápida além do holdback; texto comum em 2k/4k/8k/12k/16k aproximadamente `4.9 / 3.5 / 6.7 / 9.1 / 10.6 ms`; assignment seguro aproximadamente `1.4 / 1.6 / 3.9 / 6.2 / 7.5 ms`; focused independente `39/39` GREEN; somente os dois arquivos autorizados modificados; candidate congelado em `189c1ce`.
- `189c1ce` ainda não possui A-001 válido. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; `D-013` continua dívida histórica aberta e não foi corrigida; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi feito.
- Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..189c1ced569489508ceb7d052f5e2b521cf085dd`.

## Estado factual atualizado — A-001 / P4-PR02 — sexto ciclo

- O A-001 completo do candidate `189c1ced569489508ceb7d052f5e2b521cf085dd` foi executado por Security Reviewer independente Luna, effort `xhigh`, em nova sessão, e terminou `BLOCKED`.
- O review revalidou como verdes as classes anteriores C0/C1, CSI/VT, OSC/APC/DCS/PM/SOS, assignments, CLI/JSON/YAML/PowerShell, live/`inspect()`/persistência/reopen e complexidade dos cenários comuns.
- O único finding bloqueante novo foi P2 — DoS algorítmico por newline fragmentado. A evidência registrou focused `39/39` GREEN; primeira `npm test` `210/211`, com a única falha em `D-013`/ConPTY; `npm run probe:conpty-soak` encontrou somente `D-013`; segunda `npm test` `211/211` GREEN; `git diff --check` GREEN; worktree final limpa. Newline fragmentado mediu aproximadamente `8k 1,429s`, `12k 2,834s` e `16k 4,256s`; a causa foi o newline furar a janela de amortização e forçar `#ranges()` repetidamente sobre aproximadamente o holdback.
- O candidate `189c1ced569489508ceb7d052f5e2b521cf085dd` está `SUPERSEDED` / `INVALIDATED`; seu A-001 foi executado e terminou `BLOCKED`, portanto não é prova de integração.
- O Executor reproduziu o RED e removeu a exceção que fazia newline furar batching. Newline agora permanece pendente até a janela amortizada ou `finish()`; nenhum threshold artificial e nenhum parser novo foram criados. CRLF, multiline, C0/C1, CSI/VT, string-controls e as demais cercas foram preservados.
- O candidate atual é `76a41db64343131dfc20b699bedfae491859f88b`, parent `479f44d8ecfe9668ac64ff8a9d547f82caf81f7d`, mensagem `fix(p4-pr02): amortize newline stream scans`, contendo somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.
- Provas do novo candidate: focused `42/42` GREEN; `npm test` `214/214` GREEN; `git diff --check` GREEN; `D-013` não apareceu na execução do Executor; somente os dois arquivos autorizados foram alterados.
- Conferência externa pré-commit reproduziu fragmentação extrema: LF `2k/4k/8k/12k/16k` aproximadamente `2,34 / 3,46 / 7,54 / 8,17 / 9,06 ms`; CRLF aproximadamente `1,52 / 1,86 / 3,99 / 7,91 / 9,17 ms`. Chunk único e chunk de 1 byte produziram saída equivalente; a contraprova sensível terminou sem canário; após controle ConPTY, a regressão completa foi `214/214` GREEN.
- `76a41db` ainda não possui A-001 válido. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; `D-013` permanece aberto; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi realizado.
- Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`.

## Estado factual atualizado — A-001 GREEN_LOCAL do candidate `76a41db`

- O A-001 completo foi executado por Security Reviewer independente, em sessão nova e somente-leitura: GPT-5.6 Luna, effort `xhigh`, `quota-session`, sem API.
- Objeto revisado integralmente: `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`.
- Veredito: `GREEN_LOCAL_A-001`.
- Evidências: focused `42/42` GREEN; `npm test` `214/214` GREEN; `git diff --check` GREEN; `D-013` não ocorreu; probe ConPTY não foi necessário; worktree final limpa; nenhum arquivo rastreado foi alterado pelo Reviewer; nenhum push, merge ou deploy.
- A cobertura independente incluiu C0/C1; CSI, REP, movimentos, insert/delete/erase, queries/private/intermediates; SGR; OSC/APC/DCS/PM/SOS; formas 7-bit/C1 e incompletas; CR/LF/CRLF/backspace; assignments bare/camel/Pascal/snake/kebab/dotted/quoted; CLI; Authorization/Bearer/tokens/private keys; JSON/YAML/PowerShell e multiline; chunk único, chunks arbitrários e 1-byte; boundaries; live fragment por fragmento; `inspect()`/snapshot/reopen; abort/capacity; autorização; retenção; checksum; root safety; symlink/junction; getters/proxies/objetos hostis; frozen/detached.
- Nenhum canário alcançou live, `inspect()`, disco ou reopen. Findings P1, P2, P3 e informational de segurança: nenhum.
- Medianas independentes em chunks de 1 byte para 2k/4k/8k/12k/16k: comum `1.591 / 1.617 / 4.745 / 5.668 / 7.213 ms`; assignment seguro `0.988 / 1.870 / 3.558 / 5.762 / 8.417 ms`; terminal `1.071 / 1.837 / 3.802 / 4.330 / 5.917 ms`; string-control `0.714 / 1.376 / 2.450 / 3.658 / 5.127 ms`; LF `0.774 / 1.530 / 3.733 / 6.203 / 9.835 ms`; CRLF `0.891 / 1.696 / 3.383 / 5.570 / 8.887 ms`; combinado adversarial `0.974 / 2.010 / 5.963 / 6.158 / 8.104 ms`.
- As fronteiras 4095/4096/4097/8191/8192/8193 também passaram sem liberação de canário.
- `GREEN_LOCAL_A-001` registra somente a passagem do gate A-001 exigido para o candidate atual. Não torna P4-PR02 `PROVEN`, não autoriza por si só integração/merge e não cria precedente para outras PRs. Também não equivale ao Security Review externo indisponível.

## Resolução técnica canônica — fechamento de P4-PR02

Esta resolução é específica da P4-PR02 e não altera a política global de merge das demais PRs:

- `START_P4_PR02` é autorização coarse para continuar a unidade ativa; não equivale a autorização automática de merge.
- O HEAD a publicar no PR #18 é exatamente `b6ed5ebc6411dad07ef9193554db13e88790ccee`.
- O PR #18 permanece o veículo de integração; não abrir nova PR.
- A estratégia de integração desta PR é `merge commit`, sem squash e sem rebase, para preservar integralmente os SHAs já usados como objetos de evidência e A-001 e manter ancestry auditável.

### Fluxo obrigatório de fechamento

1. O Integrator publica a branch e verifica mecanicamente o PR #18, o HEAD/base, os checks e a ausência de drift.
2. Executa os testes/CI pré-merge aplicáveis.
3. O primeiro Auditor, em modo read-only, verifica lineage, HEAD remoto exato, A-001 `GREEN_LOCAL_A-001`, PR #18 correta, CI/testes pré-merge, ausência de drift e suficiência da evidência. Ele emite `MERGE_READY` ou `BLOCKED`.
4. Somente `MERGE_READY` permite ao Integrator realizar o merge commit no PR #18.
5. Após o merge, o Integrator descobre mecanicamente o novo HEAD real de `phase-2/runtime-v0` e executa a regressão nesse SHA.
6. A regressão pós-merge inclui, no mínimo, a instalação determinística prevista pelo target (`npm ci`, se aplicável), `focused test/stream-transcript.test.ts`, `npm test`, `git diff --check`, `npm run contract:reconcile`, validação contratual/reconciliador aplicável e confirmação de ausência de drift na integração.
7. Se D-013 ocorrer isoladamente, aplica-se somente o protocolo já documentado; não se altera P3/ConPTY dentro da P4-PR02.
8. Depois da regressão pós-merge, um Auditor read-only verifica as novas evidências e emite `P4_PR02_PROVEN_READY` ou `BLOCKED`.
9. Somente `P4_PR02_PROVEN_READY` permite ao Scribe alterar P4-PR02 para `PROVEN`.

Acceptance não é gate desta PR; permanece vinculada ao fechamento contratual correspondente. P4-PR03 permanece proibida até P4-PR02 estar documental e mecanicamente `PROVEN`.
