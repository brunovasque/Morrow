# Evidências — MORROW-MVO-001

## Baseline anterior ao contrato mestre

| unidade | status | commits / artefatos | prova | data |
|---|---|---|---|---|
| `P1-PR01` | `PROVEN_BASELINE` | `f44aace..24398de` | testes do kernel, live state, PRE_DISPATCH, loops, meeting e process adapter | 2026-08-28 |
| `P1-PR02` | `PROVEN_BASELINE` | `ff9e2c2..9e2c083` | locks, checkpoint, worktree e workspace security | 2026-08-28 |
| `P1-PR03` | `PROVEN_BASELINE` | `922e931..3931ce1` | adapter Codex quota-session, probes e shim Windows | 2026-08-28 |
| `P1-PR04` | `PROVEN_BASELINE` | `b04dc4f`, `e4a2805`, `ff0359c` | documentação observável + terminal process-backed; `npm test` 25/25 | 2026-08-28 |

## Execução corrente

| PR-ID | base SHA | candidate SHA | GitHub PR | checks | review/audit | resultado | data |
|---|---|---|---|---|---|---|---|
| `P0-PR01` | `ff0359c` | `4bcedb9` | bootstrap na branch de integração | links locais 0 quebrados; 9 fases; 42 PRs; 27 ACs cobertos; 43 requisitos; `npm test` 25/25; `git diff --check` verde | dono revisou e autorizou continuidade | `PROVEN` | 2026-08-28 |
| `P0-PR02` | `4bcedb9` | commit que contém review/contrato v1 | bootstrap na branch de integração | 29 ACs cobertos; 45 requisitos; links/IDs/dependências consistentes; `reviews/P0-PR02.md` | passes por responsabilidade + adversarial GREEN; owner approval registrada | `PROVEN` | 2026-08-28 |
| `P0-PR03` | `2f55046` | `2f34f1b` + fechamento da PR | `mvo/p0-pr03-contract-reconciler` | contraprovas de Git, dependências, mapa, rastreabilidade e preflight; `npm test` e `npm run contract:reconcile` verdes; próximo passo calculado é P2-PR01 | review interno GREEN; pacote fechado sem estado documental pendente | `PROVEN` | 2026-08-28 |
| `P2-PR01` | `37f28da` | código/teste `b9e7315`; head remoto revisado `2b67d8b` | [`PR #5`](https://github.com/brunovasque/Morrow/pull/5), `mvo/p2-pr01-worker-protocol`, merge state `CLEAN` | ADR + schema + decoder; `npm test` 48/48; compatibilidade, auth binding, scope, replay, ordering, TTL e body estrito atacados; `git diff --check` verde; 9 arquivos esperados | Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR02 somente após integração | `PROVEN` | 2026-08-28 |
| `P2-PR02` | `7b6ad6b` | código/teste `9784489`; hardening `b887443`; head remoto revisado `658da0d` | [`PR #6`](https://github.com/brunovasque/Morrow/pull/6), `mvo/p2-pr02-worker-service`, merge state `CLEAN` | serviço Local Worker configurável, raízes marcadas, start/stop/status, diagnóstico e host reiniciável; ancestral simbólico/junction recusado antes de qualquer escrita; `npm test` 56/56; `git diff --check` verde; 11 arquivos esperados; sem checks remotos configurados; sem target, dispatch, shell, rede ou credencial | Security Reviewer encontrou escape por ancestral simbólico, correção e contraprova foram revalidadas no head remoto; Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR03 somente após integração | `PROVEN` | 2026-08-28 |
| `P2-PR03` | `330bfa1` | código/teste `3b0a8be`; hardening `b8b7edc`; binding proof `d17e1eb`; trusted clock `73c353a`; head remoto revisado `fff6e2b` | [`PR #7`](https://github.com/brunovasque/Morrow/pull/7), `mvo/p2-pr03-registries`, merge state `CLEAN` | registries/resolver estritos, versões exatas, target não implícito e Secret Broker com handle opaco/idempotente e relógio confiável; `npm test` 73/73; `git diff --check` verde; 9 arquivos esperados; sem checks remotos configurados; nenhuma credencial real, dispatch, shell, rede ou target externo | Security Reviewer encontrou relógio controlável pelo chamador, correção e contraprova foram revalidadas no head remoto; Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR04 somente após integração | `PROVEN` | 2026-08-29 |
| `P2-PR04` | `7d3e91b` | código/teste `8c68d87`; hardening `1180dc6`, `240c646`; head remoto inicial `bc527ae`; corrigido e revisado `e8cd2e6` | [`PR #8`](https://github.com/brunovasque/Morrow/pull/8), `mvo/p2-pr04-routing-guards`, merge state `CLEAN` | configuração efetiva com precedência/proveniência; quota/budget com reserva, ownership, idempotência e chaves sem colisão; `npm test` 96/96; `git diff --check` verde; 9 arquivos esperados; sem checks remotos configurados; sem dispatch, processo, rede ou cobrança real | Security Reviewer encontrou colisão de IDs compostos e spoof de prefixo de erro; ambos corrigidos e revalidados no head remoto; Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR05 somente após integração | `PROVEN` | 2026-08-29 |
| `P2-PR05` | `aba8770` | código/teste `cabc1db`; head inicial `c3636cb`; hardening `caf4eed`; lifecycle `fec0525`; head remoto final `96dfdb0` | [`PR #9`](https://github.com/brunovasque/Morrow/pull/9), `mvo/p2-pr05-authenticated-dispatch`, merge state `CLEAN` | envelope autenticado → WorkSpec/WorkAuthority/PRE_DISPATCH → routing/guards → lock/workspace → PowerShell ou AgentInstance; `npm test` 109/109; PowerShell Windows e agente processual em fixtures `.morrow` temporárias; contraprovas de auth, comando bruto, hash/target/context stale, attachment/readiness/generation, idempotência/rebinding/capacity, lock, quota/budget, settlement, stdin e cleanup; `git diff --check` verde; 14 arquivos previstos; sem checks remotos configurados; sem ConPTY, persistência, credencial, rede ou target externo | revisões remotas encontraram enablement configurável, memória sem teto, stdin sem boundary e detach antigo capaz de revogar attachment pós-restart; `caf4eed` + `fec0525` corrigiram e foram revalidados no head remoto final; Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P2-PR06 somente após integração | `PROVEN` | 2026-08-29 |
| `P2-PR06` | `9b96a8b` | código/teste `d2c54de`; head inicial `3669c8a`; hardenings `9b02ba5`, `bfecf40`, `163f98e`, `2a0d59b`; head remoto final `8a6bd6e` | [`PR #10`](https://github.com/brunovasque/Morrow/pull/10), `mvo/p2-pr06-recovery`, merge state `CLEAN` | fila/checkpoint atômicos, online/connecting/offline por hello+heartbeat, replay/sequence durável por hashes, idempotência/fingerprint/capacity, retry somente pré-efeito e bloqueio fail-closed; processo filho retoma queued uma vez; kill após efeito reidrata `execution_outcome_unknown_after_restart` sem replay; segunda instância, shutdown concorrente, target incerto, corrupção/tamanho, gap de lease, status busy/draining, binding do resultado e material sensível atacados; testes focados 21/21; `npm test` 130/130; `git diff --check` verde; 14 arquivos previstos; sem checks remotos configurados; sem ConPTY, rede concreta, credencial ou target externo | revisões encontraram ausência de dono único, continuidade no mesmo target incerto, leitura antes do limite, corrida accept/close, replay não durável, liveness renovável após gap e resultado sem binding idempotente; os quatro hardenings corrigiram e provaram as superfícies; head remoto `8a6bd6e` revalidado exatamente e limpo; Architect/Security Reviewer/Reviewer: `GREEN`; merge autorizado, P3-PR01 somente após integração | `PROVEN` | 2026-08-29 |
| `P3-PR01` | `06e2a4c` | kickoff `4981ef0`; código/teste `514c5e1`; head inicial `792951d`; hardening `ecdbc55`; head remoto final `8817f03` | [`PR #11`](https://github.com/brunovasque/Morrow/pull/11), `mvo/p3-pr01-conpty-spike`, mergeable `true`, state `clean` | ADR state-of-art; interface substituível, descritor imutável e capability/presentation gate; ativação sem janela cega, stream vinculado ao protocolo e erro fatal fail-closed; pipes preservados e impedidos de alegar terminal completo; testes focados 16/16; `npm test` 141/141; `git diff --check` verde; 11 arquivos previstos; sem checks remotos configurados | revisão remota encontrou janela de output inicial, stream sem binding e erro sem stop; hardening corrigido, republicado e revalidado no head exato `8817f03`; Architect/Experimenter/Security Reviewer/Reviewer: `GREEN`; nenhuma implementação ConPTY, dependência nativa, credencial, rede ou target externo; merge autorizado, P3-PR02 somente após integração | `PROVEN` | 2026-08-29 |
| `P3-PR02` | `6168ade` | kickoff `9511e92`; código/teste `bad3942`; hardening inicial `3a28b54`; head remoto inicial `85b755c`; correções adversariais `29974cf`; head remoto corrigido `c32fcb1`; fechamento `a1c69a7` | [`PR #12`](https://github.com/brunovasque/Morrow/pull/12), merge commit `1d40eb7` em `phase-2/runtime-v0` | `node-pty` `1.1.0` exato no Windows build 19045/Node 24.14.1; Windows PowerShell persistente em perfil controlado; stream inicial, UTF-8/VT, input precoce, resize 101x37, Ctrl+C/Ctrl+Break por fixture .NET própria, exit 7, 512 KiB mais tail marker e remoção imediata da fixture; Job Object elimina descendente; falha pós-spawn preserva reserva até exit; probe 5/5; `npm test` 149/149; `git diff --check` verde; pós-merge `npm ci`, probe 5/5 e suíte 149/149 | revisão adversarial do head `85b755c` reproduziu vermelho correto `146/147` por ambiente/histórico do operador e encontrou observer tardio após spawn, release antecipado de worker/controller/helpers e fallback PATH; review remoto P1 confirmou a espera ausente do Job Controller; `29974cf` corrigiu ambiente, observers, handles e helper, e o head final foi integrado/revalidado; Architect/Test Designer/Security Reviewer/Reviewer: `GREEN`; nenhuma credencial, rede de produto, Enova ou target externo | `PROVEN` | 2026-08-30 |
| `P3-PR03` | `1d40eb7` | kickoff `94ac853`; código/teste candidate `31d2104`; hardenings `e4243ba`, `4b197b0`, `1864852`; head remoto corrigido `adc87b8`; fechamento `ffe0cc4` | [`PR #13`](https://github.com/brunovasque/Morrow/pull/13), merge commit `5624e2a` em `phase-2/runtime-v0`; comentários P1 `3890154247` e P2 `3890154252` respondidos | adapter quota-session exige descriptor ConPTY completo; preflight confirma linha auth exata; `--` impede prompt-option injection; encoder compartilhado recusa spec longo antes de auth; execução read-only preserva stream/cwd/identidades; metadata efetiva CLI `0.147.0`/`gpt-5.6-sol`/`openai`; argumento sensível redigido; probes Codex/ConPTY e quota verdes; focados com backend `28/28`; ConPTY `5/5`; suíte `156/156`; diff check e reconciliador verdes; pós-merge `npm ci`, ambos probes quota, ConPTY `5/5` e suíte `156/156` | doze achados locais/remotos, incluindo TOCTOU, auth negativo, prompt-option injection e limite do launcher, foram corrigidos, contraprovados e integrados; Architect/Test Designer/Security Reviewer/Reviewer: `GREEN`; sem leitura de credencial, Enova ou target externo | `PROVEN` | 2026-08-30 |
| `P3-PR04` | `5624e2a` | kickoff `325b08c`; candidates invalidados `ff744d2`/`62b06ff`; reentrância fatal `c62459f`; evidência vermelha `16a1756`; isolamento `c9ade54f`; docs runtime `1b50613`; IPC fail-closed `8698dd8`; head final `81dfa89` | [`PR #14`](https://github.com/brunovasque/Morrow/pull/14), merge commit `d4ccc73a91fa5267a23913c2ce4eb8906f128a44` em `phase-2/runtime-v0` | assertion `remove_pty_baton` diagnosticada no vetor global sem sincronização de `node-pty`; uma sessão/addon por host, factory nativo isolado, PID/IPC exatos e erro fatal irreversível; saídas simultâneas, crash e protocolo inválido contraprovados; candidate: ConPTY 11/11, suíte 164/164, soak 3 rodadas/12 sessões/12 hosts/51 eventos/noOrphans/fixture removida; pós-merge em `d4ccc73`: `npm ci`, ConPTY 11/11, suíte 164/164 e zero hosts/probes/filhos órfãos; 3 fixtures vermelhas originais preservadas | docs stale e janela pós-IPC inválido foram corrigidos/revalidados; remoto exato, corpo da PR e delta contratual final revisados `GREEN`; merge e regressão pós-merge confirmados sem tocar operador/target externo; Architect/Test Designer/Security Reviewer/Reviewer: `GREEN` | `PROVEN` | 2026-08-31 |
| `P4-PR01` | `461bb40` | kickoff `aafb4af`; candidate `6bbe7cd`; hardening remoto `375da19`; head final `a8bcc6b` | [`PR #16`](https://github.com/brunovasque/Morrow/pull/16), `mvo/p4-pr01-live-activity-events`, merge commit `312bd90016931f7be76810a89e79d32043253dde` em `phase-2/runtime-v0` | schema JSON `morrow.live-activity/1.0`; decoder plain/exato; dez estados AC-21; sequência/tempo/event id; identidade/correlação/causalidade imutáveis; fonte vinculada ao estado; terminal sem continuação; cópia frozen; input vazio não fabrica feed; listas required alinhadas e coleção só aceita own data elements; candidate focados 8/8, suíte 172/172 e diff/reconciliador verdes; pós-merge em `312bd90`: `npm ci`, focados 8/8 e suíte 172/172 | source spoof, Proxy hostil, salto causal, drift de required e accessor de array corrigidos; diff/schema/código/docs/corpo remoto exato revalidados `GREEN`; merge e regressão pós-merge confirmados sem target externo, segredo, rede ou processo adicional | `PROVEN` | 2026-08-31 |
| `P4-PR02` | `3657a07` | kickoff `45f32a8`; candidates/hardenings `5f9e523`/`69fce74`/`4773a5e`; heads revistos `e525eb8`/`dbcd790`/`80bd394`/`8d5f49f`/`7cde49e`/`0197429`/`2934ed3`/`1d93161`; redaction fixes `2c781b6`/`3824d1a`/`004b0d9`/`778f6a5`/`35079ab`/`1b7a223`/`8819be7`/`c8465c2`/`024c5a9`/`79382d4`; trust fixes `07e1c25`; predecessors `a44daee`, `15e3ac7`, `ba350658`, `dc0bbaf`, `95e808` e `189c1ce` superseded/invalidated; current code candidate `76a41db64343131dfc20b699bedfae491859f88b` | [`PR #18`](https://github.com/brunovasque/Morrow/pull/18), merge commit `3738d7877cc1613e363adee8063322eefb595528` em `phase-2/runtime-v0` | P4-PR02 `PROVEN` após A-001 `GREEN_LOCAL_A-001`, Auditor pré-merge `MERGE_READY`, integração em #18 e Auditor final `P4_PR02_PROVEN_READY`. A-001: focused `42/42`, `npm test` `214/214`, `git diff --check` GREEN, D-013 ausente, findings P1/P2/P3/informational: nenhum. Pós-merge: `npm ci` GREEN, focused `42/42`, `npm test` `214/214`, diff-check GREEN, sem drift, árvore do merge idêntica à do head integrado e nenhum path inesperado. A prova local não equivale ao Security Review externo indisponível e não cria precedente para outras PRs. A closure-record da PR #19 foi integrada no merge `a7f0f49efa630f927ac22f56d8cd0ce2032664cc`; ela não é nova unidade contratual, não reinicia A-001/regressão, não é P4-PR03, e P4-PR03 ainda não foi iniciada | `PROVEN` | 2026-09-10 |

## A-001 — decisão do dono e reconciliação histórica anterior à revisão local

- decisão autenticada do dono: substituir somente o gate externo indisponível de Security Review da P4-PR02 por revisão local independente de segurança;
- limite da decisão: nenhuma equivalência com o serviço externo, nenhuma extensão para outra PR e nenhuma autorização de merge;
- reconciliação em 2026-09-02 após `git fetch origin --prune`: branch local `mvo/p4-pr02-stream-redaction-transcript`; PR #18 `OPEN`, não draft, `MERGEABLE/CLEAN`; base remota `3657a070e5dc6b1e7b78fa1804761440c55efffc`; head remoto/documental pré-adendo `7fe28a32b597010cf4a869180ab640cfa2e2fb8e`; `HEAD` local e upstream idênticos; worktree limpa;
- primeiro objeto revisado: delta de transcript/redaction `3657a070e5dc6b1e7b78fa1804761440c55efffc..79382d421a9a6e9df2956007fb701d32d00c5952`, bloqueado pelo P2 algorítmico;
- objeto de re-review anterior, agora superseded/invalidated: base fixa `3657a070e5dc6b1e7b78fa1804761440c55efffc` e candidate de código `a44daee73ac6bb9b91523a947a6e0154397efcee`;
- reancoragem factual histórica em 2026-09-09: o candidate anterior `a44daee73ac6bb9b91523a947a6e0154397efcee` foi superseded/invalidated pelo microfix posterior `15e3ac733fc295d4cff3762de957f348a6e02c01`; `15e3ac7` era o candidate de código então vigente;
- provas locais atuais do candidate `15e3ac733fc295d4cff3762de957f348a6e02c01`: focal `24/24` e regressão completa `196/196`; a contraprova causal do prefixo de 30.720 maiúsculas mediu `1354,1 ms` RED contra teto de `750 ms` e aproximadamente `24,8 ms` GREEN;
- o Reviewer Luna xhigh independente emitiu `GREEN_MICROFIX` para o microfix; esse parecer cobre somente o microfix e não equivale ao A-001 completo;
- o review que então estava pendente deveria fixar exatamente a base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e o candidate `15e3ac733fc295d4cff3762de957f348a6e02c01`, em sessão independente somente-leitura;
- prova ainda ausente: relatório por revisor/sessão distintos do Executor, em checkout somente-leitura, com cobertura, ferramenta, testes, achados, limites e veredito;
- regra de bloqueio: qualquer P1/P2 impede integração e devolve a unidade ao ciclo; ausência de P1/P2 satisfaz apenas o gate local substituto, permanecendo merge e regressão pós-merge.

## A-001 — segundo ciclo bloqueado e novo candidate

- objeto revisado: base fixa `3657a070e5dc6b1e7b78fa1804761440c55efffc` contra candidate `15e3ac733fc295d4cff3762de957f348a6e02c01`;
- Security Reviewer independente em nova sessão: GPT-5.6 Luna, effort `xhigh`, `quota-session`;
- resultado: `BLOCKED` por P2 de bypass de redaction via VT CSI `b` / REP; o canário `pas<ESC>[1bword=VT_REPEAT_CANARY` foi reconstruído semanticamente como `pasword=VT_REPEAT_CANARY`, com `redactionCount: 0`, atravessando live, `inspect()` e `transcript-v1.json`;
- o Executor reproduziu o RED antes da correção e tratou CSI REP como rewrite visual/cursor-changing fail-closed;
- novo candidate criado pelo Executor: `ba350658a39f270cbc9ec559c193997a1a0db047`, parent `2258d6653b2028c94df144fd44ecae148f7e0a1e`;
- provas reportadas do novo candidate: focused `25/25` GREEN, `npm test` `197/197` GREEN e `git diff --check` GREEN;
- o candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` está `SUPERSEDED`/`INVALIDATED`; o novo candidate ainda não possui A-001 válido;
- P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido, P4-PR03 continua não autorizada e o próximo ator é Security Reviewer independente em nova sessão, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..ba350658a39f270cbc9ec559c193997a1a0db047`.

## A-001 — terceiro ciclo bloqueado e candidate real atual

- objeto a ser revisado: base fixa `3657a070e5dc6b1e7b78fa1804761440c55efffc` contra candidate `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`;
- reconciliação Git: candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`, parent `c8bb6afda8640bc11b9b82d36d931374fd725153`, mensagem `fix(p4-pr02): fail closed on untrusted terminal controls`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`, `2 files changed`, `192 insertions`, `10 deletions`, worktree limpa e branch `mvo/p4-pr02-stream-redaction-transcript` ahead 5;
- finding anterior: A-001 de `ba350658a39f270cbc9ec559c193997a1a0db047` ficou `BLOCKED` por P2 de bypass HPA + DCH; o canário atravessou live, `inspect()` e `transcript-v1.json`. O problema foi diagnosticado como classificação CSI estruturalmente insegura, não apenas ausência de HPA/DCH;
- remediação do candidate real: allowlist estrutural que descarta somente SGR numérico comprovadamente seguro e fail-closes CSI mutável, desconhecido ou não comprovado; string controls completos OSC/APC/DCS/PM/SOS foram separados do classificador CSI e consumidos/descartados com semântica equivalente 7-bit/C1; controles incompletos permanecem fail-closed. O efeito colateral 7-bit/C1 do primeiro diff foi detectado antes do commit e corrigido antes do congelamento;
- controle independente final: focused `31/31` GREEN; `npm run probe:conpty-soak` GREEN, 3 rodadas/12 sessões, `completed: 6`, `timedOut: 3`, `stopped: 3`, `collisionRefusals: 12`, 12 PIDs distintos em root/descendant/native-host, `identityBoundEvents: 50`, `inputIsolation: true`, `noOrphans: true`, `fixtureRemoved: true`; `npm test` `203/203` GREEN; `git diff --check` GREEN;
- `ba350658a39f270cbc9ec559c193997a1a0db047` está `SUPERSEDED`/`INVALIDATED`; D-013 permanece `OPEN_DEBT`, sem correção ou ocultação e sem alteração de ConPTY/P3; o candidate real ainda não possui A-001 válido; P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 não é autorizada;
- próximo ator: Security Reviewer independente, GPT-5.6 Luna, effort `xhigh`, `quota-session`, nova sessão read-only, para revisar exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`;
- external-equivalence disclaimer: esta prova local não equivale ao Security Review externo indisponível.

## Reconciliação factual — candidate `95e808`

- O candidate `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf` foi posteriormente `SUPERSEDED`/`INVALIDATED`, antes de um novo A-001 sobre ele, depois que contraprovas adicionais encontraram superfícies ainda não cobertas; não houve novo A-001 sobre `dc0bbaf`.
- REDs reproduzidos pelo Executor: opção CLI sensível; assignment JSON com whitespace multiline antes do separador; custo superlinear para string-control incompleto fragmentado; e terminador C1 incorreto em OSC, com over-redaction.
- Causas: boundary genérico sem reconhecimento da chave sensível após opção CLI; whitespace anterior ao separador sem CR/LF; `release()` reprocessando o `pending` crescente; e `terminalOscEnd()` sem reconhecimento de C1-ST.
- Correção: reconhecimento estrutural de opções CLI sensíveis; whitespace estrutural multiline; scanner incremental bounded de terminal/string-control entre chunks; reconhecimento de C1-ST em OSC; preservação das cercas CSI/VT estruturais já existentes.
- O candidate `95e808294395449b46438b799c0b7d480cece52d` tem parent `84f095d87b6f3852d736f8cb11bbfa2d56efd2d6` e contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.
- Provas reportadas pelo Executor: focused `35/35` GREEN; primeira regressão `206/207`, com a única falha correspondente ao histórico `D-013`; `npm run probe:conpty-soak` posteriormente GREEN com 12 sessões, PIDs distintos, `noOrphans: true` e fixture removida; reexecução `207/207` GREEN; `git diff --check` GREEN. A medição de string-control incompleto caiu de segundos para poucos milissegundos no mesmo envelope de `4k/8k/12k/16k`.
- D-013 permanece aberto e inalterado; ConPTY/P3 não foi alterado; não houve push, merge ou deploy. O candidate `95e808` ainda não possui A-001 válido, P4-PR02 continua `RUNNING` / `BLOCKED ON A-001`, merge continua proibido e P4-PR03 não é autorizada.
- Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`.

## A-001 — quinto ciclo: candidate `95e808` bloqueado

- objeto revisado: `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`; Security Reviewer independente, nova sessão Luna `xhigh`, read-only;
- resultado: `BLOCKED` por dois P2. O primeiro foi controle C1 stateful não reconhecido, descartado genericamente pelo normalizador, capaz de alterar a apresentação visual e reconstruir chave sensível em live, `inspect()` e snapshot persistido;
- o segundo foi custo superlinear sob fragmentação: `push()` mantinha `release()` recalculando `#ranges()` sobre `pending`; medições aproximadas do Reviewer: 1.024/82 ms, 2.048/255 ms, 4.096/957 ms, 8.192/2.633 ms e 16.384/6.014 ms, com assignments em aproximadamente 4.292 ms para 8.192 bytes;
- focused `35/35` GREEN; primeira `npm test` `207/207`; `npm run probe:conpty-soak` falhou posteriormente somente em `D-013`; segunda `npm test` `206/207`, única falha também `D-013`; transcript/redaction verde; `git diff --check` GREEN; worktree final limpa;
- `95e808` está `SUPERSEDED` / `INVALIDATED`, seu A-001 foi efetivamente executado e ficou `BLOCKED`, e não pode ser usado como prova de integração.

## Correção posterior — candidate `189c1ce`

- o Executor reproduziu os dois P2; corrigiu a classificação estrutural fechada C0/C1, mantendo descartáveis somente controles comprovadamente textualmente inertes e levando stateful, cursor/linha/tabulação/display/charset/flow-control/reservados ou desconhecidos a fail-closed;
- na fragmentação, confirmou remainder próximo de 4096 bytes após o holdback e corrigiu a revarredura por byte com scans amortizados/batched; newline força reavaliação, `finish()` mantém classificação final, `pending` permanece bounded e nenhuma liberação ignora o redactor;
- candidate: `189c1ced569489508ceb7d052f5e2b521cf085dd`, parent `b1a3bdedf2d6131702661403bf31251761e8602a6`, mensagem `fix(p4-pr02): harden terminal controls and amortize stream scans`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`;
- provas reportadas: focused `39/39` GREEN, `npm test` `211/211` GREEN, `D-013` ausente nessa execução e `git diff --check` GREEN; conferência externa pré-commit confirmou fragmentação rápida além do holdback, texto comum `4.9 / 3.5 / 6.7 / 9.1 / 10.6 ms` e assignment seguro `1.4 / 1.6 / 3.9 / 6.2 / 7.5 ms` em 2k/4k/8k/12k/16k, focused independente `39/39` e somente os dois arquivos autorizados modificados;
- estado: `189c1ce` ainda sem A-001 válido; P4-PR02 `RUNNING` / `BLOCKED ON A-001`; D-013 aberto e não corrigido; nenhum código P3/ConPTY alterado; nenhum push, merge ou deploy; próximo ator Security Reviewer independente, nova sessão Luna `xhigh`, read-only, no delta `3657a070e5dc6b1e7b78fa1804761440c55efffc..189c1ced569489508ceb7d052f5e2b521cf085dd`.

## A-001 — candidate `189c1ce` — BLOCKED

- objeto revisado: base `3657a070e5dc6b1e7b78fa1804761440c55efffc` contra candidate `189c1ced569489508ceb7d052f5e2b521cf085dd`; Security Reviewer independente Luna, nova sessão, effort `xhigh`, `quota-session`, read-only;
- classes anteriores revalidadas como verdes: C0/C1, CSI/VT, OSC/APC/DCS/PM/SOS, assignments, CLI/JSON/YAML/PowerShell, live/`inspect()`/persistência/reopen e complexidade dos cenários comuns;
- único finding bloqueante: P2 — DoS algorítmico por newline fragmentado. Newline furava a janela de amortização e forçava `#ranges()` repetidamente sobre aproximadamente o holdback; medições aproximadas: `8k 1,429s`, `12k 2,834s`, `16k 4,256s`;
- resultados do Reviewer: focused `39/39` GREEN; primeira `npm test` `210/211`, única falha em `D-013`/ConPTY; `npm run probe:conpty-soak` somente com `D-013`; segunda `npm test` `211/211` GREEN; `git diff --check` GREEN; worktree final limpa;
- o candidate `189c1ce` está `SUPERSEDED` / `INVALIDATED`; seu A-001 foi efetivamente executado e ficou `BLOCKED`, não sendo prova de integração;

## Correção posterior — candidate atual `76a41db`

- o Executor reproduziu RED, removeu a exceção que fazia newline furar batching e manteve newline pendente até janela amortizada ou `finish()`; não criou threshold artificial nem parser novo; CRLF, multiline, C0/C1, CSI/VT, string-controls e demais cercas foram preservados;
- candidate: `76a41db64343131dfc20b699bedfae491859f88b`, parent `479f44d8ecfe9668ac64ff8a9d547f82caf81f7d`, mensagem `fix(p4-pr02): amortize newline stream scans`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`;
- provas do Executor: focused `42/42` GREEN; `npm test` `214/214` GREEN; `git diff --check` GREEN; `D-013` não apareceu; somente os dois arquivos autorizados alterados;
- conferência externa pré-commit: LF `2k/4k/8k/12k/16k` aproximadamente `2,34 / 3,46 / 7,54 / 8,17 / 9,06 ms`; CRLF aproximadamente `1,52 / 1,86 / 3,99 / 7,91 / 9,17 ms`; chunk único e 1-byte com saída equivalente; contraprova sensível sem canário; após controle ConPTY, regressão completa `214/214` GREEN;
- estado: `76a41db` ainda sem A-001 válido; P4-PR02 `RUNNING` / `BLOCKED ON A-001`; `D-013` aberto; nenhum código P3/ConPTY alterado; nenhum push, merge ou deploy; próximo ator Security Reviewer independente, nova sessão Luna `xhigh`, read-only, no delta `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`.

## Registro obrigatório por PR futura

Cada linha nova deve incluir:

- objetivo exato e versão/hash do contrato/mapa;
- base/candidate SHA e URL/número do PR;
- comandos/checks realmente executados e resultado;
- evidência de Acceptance aplicável;
- Reviewer/Auditor/Security Reviewer e conclusão independente;
- superfícies invalidadas/revalidadas;
- eventos/reuniões/decisões/débitos relevantes;
- configuração runtime/model/effort/access efetiva;
- resultado `PROVEN | REJECTED | SUPERSEDED`.

Mensagem de agente, merge ou build verde isolado não é evidência suficiente.

## A-001 — candidate `76a41db` — GREEN_LOCAL_A-001

- objeto revisado integralmente: `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`;
- Security Reviewer independente: GPT-5.6 Luna, effort `xhigh`, `quota-session`, sem API, sessão nova e somente-leitura;
- veredito: `GREEN_LOCAL_A-001`;
- focused `42/42` GREEN; `npm test` `214/214` GREEN; `git diff --check` GREEN; `D-013` não ocorreu; probe ConPTY não foi necessário; worktree final limpa;
- nenhum arquivo rastreado foi alterado pelo Reviewer; nenhum push, merge ou deploy;
- cobertura independente: C0/C1; CSI, REP, movimentos, insert/delete/erase, queries/private/intermediates; SGR; OSC/APC/DCS/PM/SOS; formas 7-bit/C1 e incompletas; CR/LF/CRLF/backspace; assignments bare/camel/Pascal/snake/kebab/dotted/quoted; CLI; Authorization/Bearer/tokens/private keys; JSON/YAML/PowerShell e multiline; chunk único, chunks arbitrários e 1-byte; boundaries; live fragment por fragmento; `inspect()`/snapshot/reopen; abort/capacity; autorização; retenção; checksum; root safety; symlink/junction; getters/proxies/objetos hostis; frozen/detached;
- nenhum canário alcançou live, `inspect()`, disco ou reopen; findings P1, P2, P3 e informational de segurança: nenhum;
- medianas independentes em chunks de 1 byte para 2k/4k/8k/12k/16k: comum `1.591 / 1.617 / 4.745 / 5.668 / 7.213 ms`; assignment seguro `0.988 / 1.870 / 3.558 / 5.762 / 8.417 ms`; terminal `1.071 / 1.837 / 3.802 / 4.330 / 5.917 ms`; string-control `0.714 / 1.376 / 2.450 / 3.658 / 5.127 ms`; LF `0.774 / 1.530 / 3.733 / 6.203 / 9.835 ms`; CRLF `0.891 / 1.696 / 3.383 / 5.570 / 8.887 ms`; combinado adversarial `0.974 / 2.010 / 5.963 / 6.158 / 8.104 ms`;
- fronteiras 4095/4096/4097/8191/8192/8193 passaram sem liberação de canário;
- registro contratual: o gate A-001 exigido para o candidate atual passou, mas P4-PR02 não é promovida a `PROVEN`; integração/merge requerem etapa contratual posterior e não são autorizados por este registro;
- `GREEN_LOCAL_A-001` não equivale ao Security Review externo indisponível e não cria precedente para outras PRs.

## Fechamento final auditado — P4-PR02 — `P4_PR02_PROVEN_READY`

- PR de produto: `#18`; merge: `3738d7877cc1613e363adee8063322eefb595528`; parents: `3657a070e5dc6b1e7b78fa1804761440c55efffc` e `46167607c6f0c55a7f48eec2464a7cbda327dc22`.
- Candidate A-001 `76a41db64343131dfc20b699bedfae491859f88b` e head integrado `46167607c6f0c55a7f48eec2464a7cbda327dc22` são ancestrais; árvore do merge idêntica à árvore do head integrado; nenhum drift; nenhum path inesperado.
- Security gate: `GREEN_LOCAL_A-001`, não equivalente ao Security Review externo indisponível e sem precedente para outras PRs. Auditor pré-merge: `MERGE_READY`. Auditor final: `P4_PR02_PROVEN_READY`. Findings finais: P1 nenhum; P2 nenhum; P3 nenhum; blocker nenhum.
- Regressão pós-merge: `npm ci` GREEN; focused `42/42`; `npm test` `214/214`; `git diff --check` GREEN; D-013 não ocorreu.
- Resultado exato do reconciliador em worktree limpa: `allowed=false`, `state=BLOCKED_STATE_DIVERGENCE`, `nextPrId=P4-PR03`, `nextAuthorizedAction=START_P4_PR03`, `reasons=[git_branch_mismatch:mvo/p4-pr02-proven-record]`. A decisão auditada é `EXPECTED_DETACHED_CONTEXT_DIVERGENCE`: em detached HEAD, `git branch --show-current` é vazio e o reconciliador é branch-aware. Isso não representa regressão do artefato integrado.
- PR #18 foi o único veículo de integração do produto/código. A closure-record somente documental foi transportada pela PR #19 e integrada no merge `a7f0f49efa630f927ac22f56d8cd0ce2032664cc`; não é nova unidade contratual, não contém código/runtime/testes, não reinicia A-001 ou regressão de produto e não constitui P4-PR03. P4-PR03 ainda não foi iniciada e não está bloqueada por essa closure-record.

## START_P4_PR03 — kickoff e PRE_DISPATCH

- estado atual: `P4-PR03 = RUNNING`; `P4-PR02 = PROVEN`; nenhuma execução de código de P4-PR03 começou nesta sessão.
- base integrada fixada: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc` em `phase-2/runtime-v0`.
- branch de execução: `mvo/p4-pr03-replay-rehydration`, criada diretamente dessa base.
- contrato: `MORROW-MVO-001`, versão `1.0`, addendum efetivo `A-001`; `A-001` é exclusivo de P4-PR02 e não se aplica a P4-PR03.
- map step/route: `P4-PR03` / `REPLAY_REHYDRATION_CURSORS_LIVENESS`.
- objetivo único: implementar replay/reidratação, cursores e liveness após restart.
- critério de conclusão: o cliente retoma sem duplicar ou perder eventos e distingue esperas válidas, sessão viva/morta, Worker offline/reiniciado, lease stale e falha real.
- débitos obrigatórios, classificados como `REQUIRED_BLOCKER`: `D-014` hostile clock conversion; `D-015` snapshot TOCTOU; `D-016` coerência verificável de `redactionCount` reidratado; `D-017` identidade recuperável de lease/instância para impedir PID reuse.
- escopo adicional obrigatório: ordering; cursor válido, stale, future e invalid; restart durante e depois da persistência; redaction/segredos preservados após reidratação.
- allowed paths iniciais: `src/stream-transcript.ts`, `src/worker-recovery.ts`, testes correspondentes, e `src/event-log.ts` e/ou `src/live-activity.ts` somente se comprovadamente necessários para cursor/replay real; documentação contratual de P4-PR03.
- forbidden: P4-PR04; API/UI multi-session; P3/ConPTY; `D-013`; deploy; Enova; qualquer outro repositório; autorização genérica para todo `src/`; package files não necessários ao objetivo.
- segurança: Security Review normal, independente do Executor, obrigatório sobre o candidate completo antes da integração; nenhuma exceção A-001 será reutilizada.
- regressão final obrigatória: focused P4-PR03; focused transcript/P4-PR02; `npm test`; `git diff --check`; `npm run contract:reconcile`; validação contratual aplicável; contraprovas de restart durante/depois da persistência, replay inicial/intermediário, cursor no limite/invalid/stale/future, ordering, dedup/loss, snapshot adulterado/truncado, troca concorrente/reparse/symlink quando aplicável, hostile clock, metadata incoerente, PID reuse, lease stale, sessão viva/morta, restart repetido e preservação de redaction/segredos.
- RED obrigatório antes da correção: criar e executar contraprovas vermelhas para `D-014`..`D-017` e para as classes relevantes de replay/cursor/restart; manter cada RED causal e reproduzível no candidate.
- regressão herdada: testes aceitos de transcript/P4-PR02, baseline P3 e suíte completa permanecem obrigatoriamente verdes; não repetir a cerimônia extraordinária de A-001 da P4-PR02.
- continuidade: `SESSION_REUSE_BY_DEFAULT`; o Executor permanece na mesma sessão durante implementação e correções. Sessão nova somente para Security Reviewer independente e Auditor independente.
- routing/runtime: `manual`; access mode `quota-session`; modelo `GPT-5.6 Luna`; effort `high`; sem API; `write mode: pr-only`; workspace restrito a `D:\Morrow` e à branch dedicada.
- decisões do dono: nenhuma aberta; `P4-PR04` fora de escopo; `D-013` não entra nesta unidade; Security Review normal independente é gate antes da integração.
- perguntas bloqueantes: nenhuma.

### TASK — EXECUTOR P4-PR03

```text
Base: cd7113febd147925cc5a5ab3557cb1d2ea48d1dc
Branch: mvo/p4-pr03-replay-rehydration
Objetivo único: implementar replay/reidratação, cursores e liveness após restart.

Obrigatórios:
- D-014 hostile clock conversion, com sanitização fail-closed;
- D-015 snapshot TOCTOU, vinculando validação e leitura ao mesmo handle/mecanismo comprovável;
- D-016 redactionCount reidratado coerente e verificável com conteúdo/stream;
- D-017 identidade de lease/instância recuperável, não apenas PID reutilizável;
- replay sem duplicação e sem perda, ordering e cursor válido/stale/future/invalid;
- restart durante e depois da persistência;
- distinção de sessão viva, sessão morta, espera válida, Worker offline e falha real;
- redaction e segredos preservados após reidratação.

Antes da correção, prove RED causal e reproduzível para D-014..D-017 e para replay/cursor/restart.

Allowed paths:
- src/stream-transcript.ts
- src/worker-recovery.ts
- testes correspondentes
- src/event-log.ts e/ou src/live-activity.ts somente se necessários para replay/cursor real
- documentação contratual de P4-PR03

Forbidden: P4-PR04, API/UI multi-session, P3/ConPTY, D-013, deploy, Enova,
outros repositórios e autorização genérica para todo src/.

Antes de solicitar integração, passe focused P4-PR03, focused transcript/P4-PR02,
npm test, git diff --check, npm run contract:reconcile, validação contratual e
as contraprovas de restart/cursor/order/dedup/loss listadas no manifesto.
Security Reviewer independente deve revisar o candidate completo antes da integração.
Mantenha SESSION_REUSE_BY_DEFAULT durante implementação/correções; sessões novas
somente para Security Reviewer e Auditor independentes. Não execute push, merge,
deploy nem inicie P4-PR04.
```

- resultado PRE_DISPATCH: manifesto completo e autorizado para handoff ao Executor; o reconciliador deve confirmar `READY_FOR_EXECUTION`, `nextPrId: P4-PR03` e `nextAuthorizedAction: START_P4_PR03` em worktree limpa nesta branch.

## P4-PR03 — correção arquitetural V2 descendente de `51601a2`

- objetivo desta correção: fechar root authority configurável/adulterável, capability como MAC oracle genérico e CAS apenas intra-instância, incluindo durabilidade da âncora; o formato experimental `morrow.event-log/3` e `.event-log-key-v1` permanece inválido sem migração automática;
- `WorkerPrivateStateRoot` foi criado em `src/worker-private-state.ts`. A raiz é absoluta, canonicalizada, marcada com identidade estável de instalação/Worker, validada fora das managed roots e protegida contra symlink/junction/reparse; o `LocalWorkerService` só aceita a opção no bootstrap confiável, e o default do Event Log usa o caminho fixo da instalação derivado do módulo, nunca `process.cwd()`;
- a autoridade persistente agora vive no estado privado do Worker e o Event Log recebe somente capability opaca vinculada a `authorityRef`, `eventLogId`, `contractId`, `streamId` e `epoch`. Não há `authenticateEvent(domain)`/`verifyEvent(domain, ...)`; os domínios internos são fixos `morrow.event-log/auth/v4` e `morrow.event-log/head/v1`, separados do transcript;
- a âncora externa usa journal append-only autenticado com `PREPARE`, `COMMIT` e `ABORT`; cada registro é escrito integralmente e `FileHandle.sync()` é chamado. Tail parcial, corrupção, anchor ahead, log ahead, divergência, rollback e incerteza de crash bloqueiam sem truncar, apagar evidência ou regravar automaticamente;
- REDs reproduzidos e GREEN: root dentro da managed root, parent junction, caller com storageRoot, perda de authority após histórico, rebootstrap, capability cross-contract/cross-stream e domínio arbitrário; dois processos no mesmo `expectedPrevious` produziram exatamente um vencedor e um `event_log_anchor_cas_conflict`; lock stale foi recuperado somente com endpoint livre e binding válido, enquanto lease PID-only foi rejeitado;
- regressões mantidas: D-014, D-015, D-016, D-017, replay/cursor, recovery/liveness, ordering/dedup/loss e transcript/redaction P4-PR02. Bloom de 8 MiB permanece P3/informational e não foi redesenhado; nenhum segredo aparece em JSONL, journal, binding, erro, inspect ou evidência;
- focused executado nesta correção antes do congelamento: governance `22/22`, P4-PR03 `29/29`, transcript `42/42`, worker-recovery `21/21`, live-activity `8/8`, local-worker `10/10`; `npm test` ainda será repetido com worktree limpa após o commit final; `git diff --check` passou e o reconciliador pré-commit bloqueou somente por `git_worktree_dirty`.

## P4-PR03 — evidência factual do Executor

- D-014 RED: conversão de `Date` hostil podia lançar fora da conversão sanitizada em transcript e recovery. GREEN: toda conversão de clock aceita somente string, número ou `Date` convertível, captura falha de getter/conversão e retorna apenas `transcript_clock_invalid` ou `worker_recovery_clock_invalid`, sem payload hostil.
- D-015 RED: a leitura anterior usava inspeção de caminho seguida de `readFile`, deixando a janela de troca entre validação e conteúdo; a contraprova same-size aceitou o externo quando as identidades não eram comparadas no primeiro `fstat`. GREEN: snapshot é aberto uma vez, a identidade do handle é vinculada ao objeto inicialmente validado, tipo/tamanho/conteúdo são conferidos no mesmo handle e o caminho é conferido ao final; symlink/reparse/troca/truncamento falham fechado. Contraprovas estão em `test/p4-pr03-replay.test.ts`.
- D-016 RED: snapshot com checksum recalculado, placeholder artificial e `redactionCount` falso era aceito. GREEN: cada registro atual carrega proveniência mínima versionada (`hmac-sha256-v1`) com HMAC autenticando formato, identidade do transcript, ordinal, tempo, digest de entrada, identidade do registro, conteúdo, stream, writer, `redactionCount` e `sensitiveInput`; a chave interna do root não expõe segredo de usuário. Não há downgrade automático: snapshot atual sem formato/proveniência ou com HMAC inválido falha fechado; não foi encontrada obrigação contratual de abrir legacy automaticamente.
- D-017 RED: lease stale com PID numericamente vivo era tratado como ativo. GREEN: lease de recovery e transcript mantém endpoint nomeado da instância; PID não é autoridade. Instância viva continua exclusiva pelo endpoint, enquanto lease stale/PID reutilizado é recuperável após o endpoint ser liberado.
- Replay GREEN: a correção atual rejeita automaticamente os formatos experimentais `morrow.event-log/3` e `.event-log-key-v1`. O envelope `morrow.event-log/4` vincula sequência, tag autenticada anterior, identidade do evento/contrato e stream; a capability opaca recebe HMAC no domínio `morrow.event-log/auth/v4`, enquanto a âncora externa usa `morrow.event-log/head/v1`. A autoridade persistente fica no boundary do Secret Broker, fora da raiz gerenciada do Event Log; nenhum segredo aparece no JSONL, âncora, sidecar, erro, inspect, retorno público ou evidência. O scanner mantém teto de 1 MiB por record durante chunks, Bloom fixo de 8 MiB e continuidade sem materializar o histórico por limite. Reorder, gap, perda, duplicata, rewrite integral, rollback de head, cópia antiga, troca conjunta com sidecar, tag inválida, divergência de root/stream/contrato, anchor ahead e log ahead falham fechado; `prepared` sem append aborta somente quando o log ainda coincide com `expectedPrevious`, e append completo antes do commit é finalizado deterministicamente. `replayLiveActivity` usa sequência/identidade próprios; transcript usa ordinal próprio e rejeita gaps.
- Reidratação GREEN: snapshot checksum/políticas/ordenação/redaction continuam fail-closed; recovery mantém `queued`, `blocked`, `failed`, `completed` e `outcome_unknown` distintos, sem repetir efeito concluído ou efeito de resultado desconhecido após restart. A view expõe `liveness` derivado sem colapsar `connectivity` ou o motivo durável.
- Provas focadas desta correção descendente de `d58b3f44b1dd7b2daf883fe103af8f0993226691`: P4-PR03 `27/27`; governance/Secret Broker `18/18`; transcript `42/42`; worker-recovery `21/21`; live-activity `8/8`; suíte completa `242/242`; `git diff --check` GREEN. RED independente no candidate anterior foi rewrite integral com alteração/remoção/reindex/inserção e SHA público refeito, aceito pela cadeia não autenticada; GREEN atual rejeita essas classes pela capability HMAC e pela âncora externa. As contraprovas atuais cobrem rollback `1..5` para `1..3`, restauração integral antiga, substituição conjunta log+sidecar, parent junction, prepared sem append, append completo antes do commit, anchor ahead, log ahead sem prepared, âncora corrompida, root/key ausente ou corrompida, root diferente, cursor hostil e restart/reopen válido. A medição anterior do scanner permanece indicativa: limite pequeno retorna somente a janela solicitada e memória não cresce com IDs do histórico; Bloom de 8 MiB é preservado como finding P3/informational, sem redesenho.
