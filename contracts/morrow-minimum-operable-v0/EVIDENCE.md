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
- focused executado nesta correção: governance `22/22`, P4-PR03 `29/29`, transcript `42/42`, worker-recovery `21/21`, live-activity `8/8`, local-worker `10/10`; `npm test` padrão `248/248` GREEN, incluindo ConPTY; execução serial `248/248` GREEN; `git diff --check` passou e `contract:reconcile` em worktree limpa retornou `allowed=true`, `READY_FOR_EXECUTION`, sem razões.

## P4-PR03 — evidência factual do Executor

- D-014 RED: conversão de `Date` hostil podia lançar fora da conversão sanitizada em transcript e recovery. GREEN: toda conversão de clock aceita somente string, número ou `Date` convertível, captura falha de getter/conversão e retorna apenas `transcript_clock_invalid` ou `worker_recovery_clock_invalid`, sem payload hostil.
- D-015 RED: a leitura anterior usava inspeção de caminho seguida de `readFile`, deixando a janela de troca entre validação e conteúdo; a contraprova same-size aceitou o externo quando as identidades não eram comparadas no primeiro `fstat`. GREEN: snapshot é aberto uma vez, a identidade do handle é vinculada ao objeto inicialmente validado, tipo/tamanho/conteúdo são conferidos no mesmo handle e o caminho é conferido ao final; symlink/reparse/troca/truncamento falham fechado. Contraprovas estão em `test/p4-pr03-replay.test.ts`.
- D-016 RED: snapshot com checksum recalculado, placeholder artificial e `redactionCount` falso era aceito. GREEN: cada registro atual carrega proveniência mínima versionada (`hmac-sha256-v1`) com HMAC autenticando formato, identidade do transcript, ordinal, tempo, digest de entrada, identidade do registro, conteúdo, stream, writer, `redactionCount` e `sensitiveInput`; a chave interna do root não expõe segredo de usuário. Não há downgrade automático: snapshot atual sem formato/proveniência ou com HMAC inválido falha fechado; não foi encontrada obrigação contratual de abrir legacy automaticamente.
- D-017 RED: lease stale com PID numericamente vivo era tratado como ativo. GREEN: lease de recovery e transcript mantém endpoint nomeado da instância; PID não é autoridade. Instância viva continua exclusiva pelo endpoint, enquanto lease stale/PID reutilizado é recuperável após o endpoint ser liberado.
- Replay GREEN: a correção atual rejeita automaticamente os formatos experimentais `morrow.event-log/3` e `.event-log-key-v1`. O envelope `morrow.event-log/4` vincula sequência, tag autenticada anterior, identidade do evento/contrato e stream; a capability opaca recebe HMAC no domínio `morrow.event-log/auth/v4`, enquanto a âncora externa usa `morrow.event-log/head/v1`. A autoridade persistente fica no boundary do Secret Broker, fora da raiz gerenciada do Event Log; nenhum segredo aparece no JSONL, âncora, sidecar, erro, inspect, retorno público ou evidência. O scanner mantém teto de 1 MiB por record durante chunks, Bloom fixo de 8 MiB e continuidade sem materializar o histórico por limite. Reorder, gap, perda, duplicata, rewrite integral, rollback de head, cópia antiga, troca conjunta com sidecar, tag inválida, divergência de root/stream/contrato, anchor ahead e log ahead falham fechado; `prepared` sem append aborta somente quando o log ainda coincide com `expectedPrevious`, e append completo antes do commit é finalizado deterministicamente. `replayLiveActivity` usa sequência/identidade próprios; transcript usa ordinal próprio e rejeita gaps.
- Reidratação GREEN: snapshot checksum/políticas/ordenação/redaction continuam fail-closed; recovery mantém `queued`, `blocked`, `failed`, `completed` e `outcome_unknown` distintos, sem repetir efeito concluído ou efeito de resultado desconhecido após restart. A view expõe `liveness` derivado sem colapsar `connectivity` ou o motivo durável.
- Provas focadas desta correção descendente de `d58b3f44b1dd7b2daf883fe103af8f0993226691`: P4-PR03 `27/27`; governance/Secret Broker `18/18`; transcript `42/42`; worker-recovery `21/21`; live-activity `8/8`; suíte completa `242/242`; `git diff --check` GREEN. RED independente no candidate anterior foi rewrite integral com alteração/remoção/reindex/inserção e SHA público refeito, aceito pela cadeia não autenticada; GREEN atual rejeita essas classes pela capability HMAC e pela âncora externa. As contraprovas atuais cobrem rollback `1..5` para `1..3`, restauração integral antiga, substituição conjunta log+sidecar, parent junction, prepared sem append, append completo antes do commit, anchor ahead, log ahead sem prepared, âncora corrompida, root/key ausente ou corrompida, root diferente, cursor hostil e restart/reopen válido. A medição anterior do scanner permanece indicativa: limite pequeno retorna somente a janela solicitada e memória não cresce com IDs do histórico; Bloom de 8 MiB é preservado como finding P3/informational, sem redesenho.

## P4-PR03 — correção de configuração do Local Worker e bootstrap concorrente

- objeto desta correção: candidate bloqueado `18d2375b40439f6927dbccc294fb31a98e015fe6`, parent `ad7d1da613c237bb326c61b1cc164bd022e977c2`, branch `mvo/p4-pr03-replay-rehydration`; escopo restrito a `src/local-worker-service.ts`, `src/worker-private-state.ts`, `src/governance-registries.ts`, testes correspondentes e esta evidência;
- P2-01 RED reproduzido: no candidate, `LocalWorkerServiceConfiguration.privateStateRoot` permitia iniciar Worker A com private root dentro da managed root já pertencente ao Worker B. GREEN: `privateStateRoot` foi removido da configuração operacional; `LocalWorkerService` usa somente `WorkerPrivateStateRoot.forWorker()`, que deriva `private\worker-installation\<workerId>` a partir do módulo/instalação. A região fixa é reservada lexicalmente antes de `mkdir`, com comparação Windows case-insensitive e normalização de `..`; managed roots iguais, ancestrais ou descendentes são rejeitadas, e as cercas existentes de canonicalização, symlink/junction/reparse continuam antes da criação e após `realpath`;
- contraprova cross-worker GREEN: Worker A inicia com private root derivada; managed root B sob essa private root é recusada antes de criação com `worker_managed_root_overlaps_private_state_region`. Campo caller-controlled, igualdade, ancestralidade, descendência, spelling em case diferente e caminho com `..` são recusados. O `bootstrap()` com caminho temporário permanece apenas como factory explícita dos testes de storage, não é aceito pela configuração do Local Worker;
- P2-02 RED reproduzido: a corrida de criação de binding/key alcançava `isAlreadyExists` indefinida e podia lançar `ReferenceError`. GREEN: o helper reconhece somente `Error.code === "EEXIST"`; permission, I/O, path inválido, reparse e corrupção continuam falhas fechadas. O focused multiprocesso usa oito processos independentes, não sobrescreve key/binding, não emite exceção bruta e reabre a mesma autoridade; dez execuções consecutivas do arquivo governance passaram `23/23` sem flakiness;
- regressões preservadas e revalidadas: CAS multiprocesso `1 winner/1 event_log_anchor_cas_conflict`, stale lock/PID reuse, journal PREPARE/COMMIT/ABORT e `FileHandle.sync()`, rollback e cópia antiga, log+authority replacement, parent junction, key ausente após histórico, D-014, D-015, D-016, D-017, replay/cursor, recovery/liveness, transcript/redaction e Bloom bounded;
- resultados desta correção: focused P4-PR03 `29/29`, governance `23/23`, Local Worker `11/11`, transcript/recovery/live `71/71`, suíte completa `250/250`, `git diff --check` GREEN. `npm run contract:reconcile` deve ser executado no congelamento do candidate e seu resultado será registrado junto ao SHA final;

## P4-PR03 — validação canônica de `workerId`

- RED reproduzido no candidate `ea4bcaa9fd8d2b3de0f079ac05f3ba00165a3d1b`: `WorkerPrivateStateRoot.forWorker()` aceitava identificadores com `/`, incluindo composição com `..`, e podia produzir private root fora de `private\\worker-installation\\<workerId>`; as classes `\\`, absoluto, drive, UNC e `.` eram cobertas como entradas hostis da factory;
- GREEN: a única primitive `isValidWorkerId()` agora vive em `src/worker-private-state.ts` e é usada por `LocalWorkerService`, `WorkerPrivateStateRoot.forWorker()` e validação de bootstrap/marker. A validação ocorre antes de `join`, `resolve`, canonicalização ou filesystem; exige exatamente o formato previamente aceito pelo Local Worker: primeiro caractere alfanumérico, seguido por no máximo 63 caracteres alfanuméricos, `.`, `_` ou `-`;
- a factory de produção sempre acrescenta exatamente um segmento validado sob `D:\\Morrow\\private\\worker-installation`, sem separadores, drive, UNC ou navegação. A reserva global e a checagem canônica existente permanecem como defesa adicional;
- contraprovas GREEN: separadores, traversal, path absoluto/drive/UNC, `.` e diferenças de case são recusados; IDs legítimos `worker-1`, `Worker.A_2`, `a`, `A` repetido 64 vezes e `a..b` são aceitos sem divergência entre Local Worker e factory. Bootstrap e restart legítimos preservam a autoridade;
- regressões desta correção: focused P4-PR03 `29/29`, governance `23/23`, Local Worker `12/12`; D-014..D-017, CAS multiprocesso, rollback, rebootstrap, journal, replay/cursor, recovery/liveness, transcript/redaction e parent junction permanecem GREEN. O novo candidate é descendente de `ea4bcaa9fd8d2b3de0f079ac05f3ba00165a3d1b` e não altera Event Log, transcript, recovery ou Live Activity;

## P4-PR03 — candidate final e Control Root documental

- `EXECUTION_CANDIDATE_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`;
- parent: `ea4bcaa9fd8d2b3de0f079ac05f3ba00165a3d1b`;
- base contratual: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`;
- branch: `mvo/p4-pr03-replay-rehydration`;
- o delta total base→candidate permanece dentro da P4-PR03; não contém P4-PR04, P3/ConPTY, D-013, package drift, UI/API multi-session, deploy ou outro repositório;
- `SECURITY_REVIEW_GREEN — P4_PR03_READY_FOR_INTEGRATION_PREFLIGHT`, associado exatamente ao Execution Root `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; P1 nenhum, P2 nenhum, directory sync P3 operacional, Bloom P3/informational, zero scope drift e zero mutação pelo Security Reviewer;
- resultados fresh: governance/private state `23/23`; Local Worker `12/12`; P4-PR03 `29/29`; transcript `42/42`; recovery `21/21`; Live Activity `8/8`; bootstrap multiprocessado `10 × 8` sem flakiness; CAS `1 winner / 1 event_log_anchor_cas_conflict`; `npm test` final `251/251`; `git diff --check` GREEN; `npm run contract:reconcile` `allowed=true`;
- a primeira full regression teve EBUSY isolado em ConPTY; o retry integral passou `251/251`, sem reprodução causal; o evento foi classificado como não bloqueante sob D-013 e nenhuma alteração P3/ConPTY foi feita;
- este commit é somente `CONTROL_ROOT_DOCUMENTARY_RECONCILIATION`; `CONTROL_ROOT_SHA` é o SHA deste commit documental, capturado após sua criação. Ele não substitui nem reidentifica o `EXECUTION_CANDIDATE_SHA`; Reviewer/Auditor devem comparar ambos mecanicamente e confirmar zero mudança em `src/`, `test/` e package files após o Execution Root.

## P4-PR03 — Independent Reviewer Gate e primeira auditoria

- `EXECUTION_ROOT_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`;
- Control Root revisado pelo Reviewer: `02d64f74ebff46bb8f79e545bcc60f6666f8da2c`;
- Reviewer Independent Gate: sessão independente do Executor, modo read-only, Execution Root `d63a19c2...`, Control Root `02d64f74...`, genealogia GREEN, delta documental somente nos quatro documentos canônicos, Security Review fresh, cobertura contratual fresh, scope GREEN, reconciler `allowed=true`, zero mutação;
- resultado factual do Reviewer: `REVIEW_READY_FOR_AUDITOR`;
- Auditor independente executado depois do Reviewer: `AUDIT_BLOCKED`;
- classificação do bloqueio da primeira auditoria: `documentation`, `independence evidence`, `authorization`;
- confirmações do Auditor: Execution Root correto, Control Root correto, genealogia GREEN, delta técnico GREEN, Security Review fresh, cobertura/regressão suficiente, scope GREEN, EBUSY/D-013 não bloqueante, P3 conhecidos não bloqueantes e zero mutação;
- causa exclusiva do bloqueio: `REVIEW_READY_FOR_AUDITOR` ainda não estava versionado e `LIVE_STATUS` ainda projetava `P4_PR03_INDEPENDENT_REVIEW_PENDING`;
- esta reconciliação é o novo Control Root documental descendente de `02d64f74...`; `NEW_CONTROL_ROOT_SHA` é o SHA deste único commit documental, capturado após sua criação. Não é novo candidate técnico e não altera o `EXECUTION_ROOT_SHA`;
- autorização: Auditor recheck pendente; `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR` é obrigatório antes de qualquer push, abertura de PR, integração ou merge.

## P4-PR03 — Auditor recheck GREEN

- `EXECUTION_ROOT_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a` permanece imutável;
- Control Root anterior: `c242c06a3cfa31f9b04ce28a325e4e434b4b0f17`;
- Control Root auditado no recheck: `c242c06a3cfa31f9b04ce28a325e4e434b4b0f17`;
- o Auditor independente revalidou os blockers anteriores — `documentation`, `independence evidence` e `authorization` — e confirmou que todos foram resolvidos;
- confirmações do Auditor: genealogia GREEN; delta documental somente docs; zero mutação técnica; Reviewer versionado e independente; Security Review fresh; estado canônico coerente; reconciler `allowed=true`; zero mutação pelo Auditor;
- resultado exato: `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR`;
- determinação do Auditor: `AUDIT_VERDICT_MUST_BE_VERSIONED_BEFORE_INTEGRATOR`;
- este commit é somente `CONTROL_ROOT_DOCUMENTARY_RECONCILIATION`, descendente do Control Root anterior. `NEW_CONTROL_ROOT_SHA` é o SHA deste único commit documental, capturado após sua criação; não é novo candidate técnico e não substitui o `EXECUTION_ROOT_SHA`;
- autorização exata: o Integrator pode somente fazer push da branch aprovada, abrir/atualizar PR contra `phase-2/runtime-v0`, capturar PR number/id, head/base SHA e URL/metadata factual disponível, executar os gates pós-abertura exigidos e retornar ao próximo gate. Merge não está autorizado; qualquer alteração técnica exige novo candidate e novo ciclo de review;
- a sequência histórica fica preservada: Security GREEN → Reviewer GREEN → primeira auditoria `AUDIT_BLOCKED` por documentação → reconciliação documental → Auditor recheck `AUDIT_GREEN` → Integrator.

## P4-PR03 — reconciliação documental da identidade da PR #21

- `EXECUTION_ROOT_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; permanece imutável e não é reidentificado pelo commit documental.
- `OPENING_CONTROL_ROOT_SHA`: `de47fd7a3f919a7094a16c051548cef0a47bf51a`.
- Identidade estável da PR: repositório `brunovasque/Morrow`; PR `#21`; URL `https://github.com/brunovasque/Morrow/pull/21`; head branch `mvo/p4-pr03-replay-rehydration`; base branch `phase-2/runtime-v0`.
- Opening PR head SHA: `de47fd7a3f919a7094a16c051548cef0a47bf51a`; opening base SHA: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`.
- Estado factual na abertura: PR `OPEN`, não draft, mergeable; branch remota criada; remote head na abertura igual a `de47fd7a3f919a7094a16c051548cef0a47bf51a`; PR criada contra `phase-2/runtime-v0`.
- Gates frescos preservados: Security `GREEN`; Reviewer `GREEN` com `REVIEW_READY_FOR_AUDITOR`; Auditor `GREEN` com `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR`; Integrator autorizado para a etapa pós-abertura.
- Abertura registrou nenhum check automático reportado, diff de `16 paths`, zero workflow/package drift e `npm run contract:reconcile` como `allowed=true`, `READY_FOR_EXECUTION`, `START_P4_PR03`.
- Merge está explicitamente proibido. O Integrator informou zero mutação local; o push autorizado é normal/fast-forward, sem force.
- Estado documental: `PR_IDENTITY_VERSIONED`. Isso versiona a identidade estável e não autoriza merge, não cria unidade nova e não transforma o commit documental em requisito recursivo de conter seu próprio SHA como head atual da PR.
- O novo commit será o novo Control Root documental, descendente do opening Control Root. Isso não cria nova Execution Root, não muda a unidade P4-PR03 e não exige re-review técnica apenas por esta reconciliação documental.
- Próximo ator único: o mesmo Integrator persistente, somente para confirmar o novo Control Root, fazer push fast-forward normal da mesma branch, confirmar que a PR #21 continua a mesma PR e que o remote head é o novo Control Root, executar/observar gates pós-PR e retornar ao próximo gate canônico. P4-PR03 permanece `RUNNING` e não `PROVEN`; P4-PR04 permanece `PENDING`.

## P4-PR03 — MERGE_READY versionado antes do merge

- `EXECUTION_ROOT_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; permanece imutável e continua sendo o único candidate técnico.
- `OPENING_CONTROL_ROOT_SHA`: `de47fd7a3f919a7094a16c051548cef0a47bf51a`.
- Current Control Root/head antes deste registro: `8e819a9633f70c210b663db4edea53f6350ed347`.
- PR: `#21`, branch `mvo/p4-pr03-replay-rehydration`, base `phase-2/runtime-v0` em `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`.
- Auditor pré-merge: `MERGE_READY`; determinação: `MERGE_READY_MUST_BE_VERSIONED_BEFORE_MERGE`; blockers: `NONE`.
- Security `GREEN`, Reviewer `GREEN`, Auditor pré-PR `GREEN`; nenhum novo julgamento técnico é criado por este registro documental.
- `MERGE_READY` está versionado; o merge da PR #21 fica autorizado sob as cercas mecânicas aplicáveis. P4-PR03 permanece `RUNNING` até a reconciliação pós-merge e o Auditor final; P4-PR04 permanece `PENDING`.
- Este commit é exclusivamente documental/control-plane, não cria nova Execution Root, não altera código/testes/package/workflow/deploy e não é novo candidate técnico. O SHA deste commit é capturado externamente pelo Integrator como `PRE_MERGE_CONTROL_ROOT_SHA`, sem self-reference documental.

## P4-PR03 — merge integrado e regressão pós-merge

- `EXECUTION_ROOT_SHA`: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; permanece imutável e continua sendo o único candidate técnico.
- `PRE_MERGE_CONTROL_ROOT_SHA`: `cf44e9b728884bcd1452a1e8e4fef0470e7d341e`; commit documental que versionou `MERGE_READY` antes da integração.
- PR de produto: `#21`, `https://github.com/brunovasque/Morrow/pull/21`; head aprovado antes do merge `cf44e9b728884bcd1452a1e8e4fef0470e7d341e`; base `phase-2/runtime-v0` em `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`.
- `MERGE_SHA`: `b95b15a61b549eaa779b26b034cea4d57adf9e74`; parents, na ordem real: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc` e `cf44e9b728884bcd1452a1e8e4fef0470e7d341e`.
- A PR #21 ficou `MERGED`; a árvore do merge é idêntica à árvore do head aprovado; o delta integrado contém os 16 paths da PR, sem path inesperado, workflow, package ou deploy drift, e `git diff --check` ficou GREEN.
- Regressão pós-merge no `MERGE_SHA`: `npm ci` GREEN; focused P4-PR03 `29/29` GREEN; focused transcript/P4-PR02 `42/42` GREEN.
- `npm test`: primeira execução observada `251/252`, com uma falha isolada de atividade assíncrona `EBADF` em `test/kernel.test.ts`; reexecução imediata `251/251` GREEN. O evento não corresponde ao D-013 documentado, não se reproduziu e não produziu alteração de código; fica explicitamente disponível para julgamento do Auditor final, sem ser promovido a finding causal.
- `npm run contract:reconcile` no checkout limpo de `phase-2/runtime-v0` retornou exatamente `allowed=false`, `state=BLOCKED_STATE_DIVERGENCE`, `nextPrId=P4-PR03`, `nextAuthorizedAction=START_P4_PR03`, `reasons=[git_branch_mismatch:phase-2/runtime-v0]`. Como no fechamento anterior, a decisão é `EXPECTED_BRANCH_CONTEXT_DIVERGENCE`: o reconciliador é branch-aware e a base integrada não é a branch dedicada da unidade; isto não é drift da árvore nem regressão do produto.
- `REGRESSION_VETO`: `PASS`. O gate canônico em `governance/gates/REGRESSION_VETO.md` foi aplicado à manifestação pós-merge: árvore/parents/diff-check, `npm ci`, focados, suíte completa reexecutada e reconciliador. A primeira suíte `251/252` por `EBADF` assíncrono isolado não se reproduziu na reexecução `251/251` e não provou regressão de comportamento; D-013 não ocorreu e nenhuma mudança P3/ConPTY foi feita.
- P4-PR03 permanece `RUNNING` e não `PROVEN`; P4-PR04 permanece `PENDING` e proibida até o fechamento final de P4-PR03.
- Este registro é somente documental/control-plane. O SHA deste commit é capturado externamente como `POST_MERGE_CONTROL_ROOT_SHA`, sem self-reference e sem nova Execution Root.
- Próximo ator único: Auditor final independente, em sessão nova e read-only, julgando merge real, árvore/parents, regressão, ausência de drift, cobertura, o evento isolado `EBADF` e a prontidão para emitir o veredito final definido pelo contrato. Nenhum novo Scribe, Reviewer, Security Review, merge ou deploy é autorizado nesta etapa.

## P4-PR03 — fechamento final auditado

- `FINAL_AUDIT_GREEN` foi emitido por Auditor final independente, em sessão nova e read-only, sobre o merge real e a evidência pós-merge.
- A PR #21 está integrada em `b95b15a61b549eaa779b26b034cea4d57adf9e74`; parents corretos: `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc` e `cf44e9b728884bcd1452a1e8e4fef0470e7d341e`.
- A árvore integrada é equivalente à árvore do head aprovado `cf44e9b728884bcd1452a1e8e4fef0470e7d341e`, sem drift.
- Evidência pós-merge preservada: `npm ci` GREEN; P4-PR03 `29/29`; transcript `42/42`; primeira full `251/252` por `EBADF` isolado; retry `251/251`; `git diff --check` GREEN; `REGRESSION_VETO` `PASS`.
- O `EBADF` foi não causal e não bloqueante; o reconciliador na base retornou somente o `git_branch_mismatch:phase-2/runtime-v0` esperado pelo comportamento branch-aware.
- Security Review, Reviewer independente e Auditor pré-merge permanecem válidos; o Auditor final confirmou `FINAL_AUDIT_GREEN`.
- Com a integração desta closure-record, o estado efetivo de P4-PR03 é `PROVEN`. Isto não cria novo candidate técnico nem altera código, testes, package, workflow ou deploy.
- P4-PR04 passa a ser o próximo PR autorizado após a integração desta closure; seu objetivo é expor stream/API de múltiplas sessões e provar observabilidade ponta a ponta do Worker, com prova de duas sessões reais vistas ao vivo e reidratadas após restart.
- Dependências satisfeitas para P4-PR04: P4-PR03 `PROVEN` e P3-PR04 `PROVEN`. Próximo ator único: Orchestrator / Contract Engineer persistente, responsável por kickoff, PRE_DISPATCH e TASK do Executor de P4-PR04.

## P4-PR03 — entrada final na tabela de evidências

| `P4-PR03` | `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc` | `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a` | [`PR #21`](https://github.com/brunovasque/Morrow/pull/21), merge `b95b15a61b549eaa779b26b034cea4d57adf9e74`; closure PR #22 | `npm ci` GREEN; P4-PR03 `29/29`; transcript `42/42`; retry `251/251`; `git diff --check` GREEN; `REGRESSION_VETO` `PASS`; zero drift | Security `GREEN`; Reviewer `GREEN`; Auditor pré-merge `MERGE_READY`; Auditor final `FINAL_AUDIT_GREEN` | `PROVEN` | 2026-09-11 |

## START_P4_PR04 — kickoff, PRE_DISPATCH e TASK

- estado atual: `P4-PR04 = RUNNING`; `P4-PR03 = PROVEN`; `P3-PR04 = PROVEN`;
- base integrada fixada: `78e1bfdc7d32f2e150d03aaee80b62514c446d4f` em `phase-2/runtime-v0`;
- branch de execução criada diretamente da base: `mvo/p4-pr04-multi-session-stream`;
- objetivo único: expor stream/API local de múltiplas sessões e provar observabilidade ponta a ponta do Worker;
- prova de conclusão: duas sessões reais vistas ao vivo de forma incremental e reidratadas após restart;
- A-001 não se aplica a P4-PR04; D-013 permanece fora do escopo salvo regressão causal nova;
- não há owner decision ou blocking question aberta; `QUESTIONS.md` permanece com `blocking_question_count: 0`;
- Security Review normal independente é obrigatório antes da integração porque a unidade toca processo, stream, transcript/redaction, persistência e superfície consumível pelo Worker. Não há execução de Security Review nesta etapa e A-001 não é herdado;
- PRE_DISPATCH: base correta, dependências `PROVEN`, branch dedicada, target `morrow-core`, scope/allowed paths/forbidden paths, critérios e regressão herdada foram fixados; nenhum drift foi introduzido.

### Decisão técnica mínima

As primitivas já provadas são suficientes e devem ser compostas, não redesenhadas:

- `TerminalSessionManager` já fornece sessões reais isoladas por `terminalSessionId`, `agentInstanceId`, `workspaceId`, fan-out incremental via `subscribe()`, `list()`, `snapshot()` e `history()`; o teto ConPTY provado de duas sessões permanece;
- `LiveActivityEvent` já fixa `terminalSessionId`, `agentInstanceId`, `workspaceId`, causalidade e ordem; o projector/replay existente deve ser filtrado por sessão sem alterar P4-PR01;
- `JsonlEventLog` já fornece Event Log autenticado, ordenado e reidratável por contrato; `PersistentTranscriptStore` já fornece redaction, retenção, identidade da sessão e replay/cursor; `WorkerRecoveryCoordinator` já distingue offline/recovery/resultado desconhecido;
- a lacuna é uma composição `WorkerSessionStream` estreita que vincule essas fontes por sessão, publique somente eventos após persistência autorizada, forneça cursor/replay por `terminalSessionId` e reconstitua o catálogo após restart. Não criar socket, rede, UI, dashboard ou autoridade paralela nesta unidade;
- output bruto nunca atravessa a API: `TERMINAL_OUTPUT` passa pelo `StreamRedactorSession` e pelo transcript existente antes de persistência/publicação. Eventos de input carregam apenas metadados permitidos;
- sessão `running` encontrada sem fechamento após restart não volta a ser `running` por suposição: deve ser `recovering`, `offline` ou `outcome_unknown` conforme `WorkerRecoveryCoordinator`; somente nova sessão/heartbeat/reattach comprovado pode publicar liveness viva.

### TASK — EXECUTOR P4-PR04

```text
Base: 78e1bfdc7d32f2e150d03aaee80b62514c446d4f
Branch: mvo/p4-pr04-multi-session-stream
Target: morrow-core; integration branch phase-2/runtime-v0
Objetivo único: expor stream/API local de múltiplas sessões e provar observabilidade ponta a ponta do Worker.
Prova: duas sessões reais simultâneas, com identidade inequívoca, eventos incrementais antes do término,
isolamento A/B e reconstrução correta das duas após restart.

Comportamento mínimo da superfície:
- criar/listar/consultar sessões por contractId + terminalSessionId, preservando agentInstanceId,
  workspaceId, roleId, runtimeId, backend/protocol/capabilities e estado mecânico;
- subscribe(contractId, terminalSessionId) entrega somente eventos dessa sessão e só depois da
  persistência autorizada; unsubscribe não altera o Worker;
- replay/reconnect usa cursor vinculado ao contractId + terminalSessionId + streamId e retorna
  ok/invalid/stale/future sem duplicar nem perder registros; ordem e causalidade são preservadas;
- a reconstrução após restart lê Event Log/transcript/recovery duráveis, restaura catálogo e cursor
  por sessão, mantém sessão encerrada terminal e não inventa sessão viva;
- Live Activity e transcript continuam ligados à identidade original; redaction e segredos permanecem
  preservados em live, replay, disco e reopen.

Allowed paths — somente estes, com a justificativa causal:
- src/worker-session-stream.ts — nova composição/API estreita de catálogo, fan-out, cursor e replay por sessão;
- src/event-log.ts — somente se uma primitiva de replay/session-sequence segura for necessária; não alterar
  root of trust, capability, CAS ou formato autenticado já provado;
- src/local-worker-service.ts — somente para ownership/lifecycle do stream no Worker, se a composição não
  puder ser ligada fora do serviço;
- src/local-worker-host.ts — somente para expor o control surface local e provar restart do processo real;
- schema/worker-session-stream.v1.schema.json — contrato wire/API versionado, se o envelope público exigir schema;
- runtime/MULTI_SESSION_STREAM_API.md — contrato factual da API e semântica de restart/cursor;
- test/worker-session-stream.test.ts — focused tests da API, duas sessões, fan-out, replay e restart;
- test/fixtures/worker-session-stream-child.ts — somente se o teste de restart exigir processo Worker filho real;
- test/event-log.test.ts, test/terminal-session.test.ts, test/live-activity.test.ts,
  test/stream-transcript.test.ts, test/worker-recovery.test.ts, test/local-worker-service.test.ts — somente
  contraprovas diretamente causais e mínimas nas primitivas tocadas.

Forbidden:
- src/stream-transcript.ts, src/worker-recovery.ts, src/live-activity.ts e src/terminal-session.ts não
  devem ser alterados inicialmente; só entram se uma lacuna causal comprovada impedir a composição, com
  regressão específica e sem redesenhar a superfície GREEN;
- P4-PR03, D-014..D-017, D-013, P3/ConPTY, P4-PR02/redaction, P4-PR01 schema, salvo regressão causal;
- P5/UI/dashboard/panes/xterm/chat/reunião/notifications/Nexus;
- package files, workflows, deploy, rede, sockets externos, cloud, Enova ou qualquer outro repositório;
- API multi-operator/multi-tenant, aumento do teto ConPTY acima de duas sessões e refactors oportunistas;
- push, abertura/atualização de PR, merge ou deploy pelo Executor.

REDs obrigatórios antes das correções:
1. duas sessões reais simultâneas com tokens A/B distintos: output/evento atribuído à sessão errada;
2. subscribe tardio perde evento inicial ou não recebe atividade incremental antes do término;
3. cursor A reaparece com evento duplicado, perde evento, aceita streamId/sessionId/contractId de B,
   ou classifica cursor stale/future/invalid como ok;
4. restart/reopen reconstrói somente A, troca identidades, reinicia sessão terminada como viva,
   ou fabrica atividade sem evento durável;
5. processo/Worker offline, waiting, recovering, failed e done são colapsados em um único estado;
6. output secreto aparece no stream live, Event Log, transcript, replay, snapshot ou após reopen;
7. evento de Live Activity/transcript de A cruza o filtro de B, ou causalidade/ordem quebra após replay;
8. erro de persistência publica evento live mesmo sem durable commit, ou subscriber hostil altera a prova;
9. restart durante duas sessões deixa processo/host/fixture órfão, duplica registro ou permite rebind
   para workspace/agent/session diferente.

GREEN criteria:
- prova real com duas sessões simultâneas no backend aprovado, workspaces distintos e tokens exclusivos;
- eventos incrementais observados antes dos dois términos, com identidade e ordering verificáveis;
- zero cross-session leakage, zero duplicação e zero perda em live, replay e reconexão;
- replay por sessão cobre início, cursor intermediário, limite, cursor stale/future/invalid e restart;
- restart do Worker/control surface reconstitui as duas sessões pelo estado durável existente;
- sessão terminada permanece terminal; sessão sem fechamento não é marcada concluída nem viva por suposição;
- redaction/segredos preservados em live, Event Log, transcript, snapshot, replay e reopen;
- `git diff --check`, `npm test`, focused P4-PR04 e focused regressions das superfícies tocadas GREEN;
- regressão herdada obrigatória: focused P4-PR01 Live Activity, P4-PR02 transcript/redaction,
  P4-PR03 replay/recovery/cursor/liveness, P3-PR04 terminal/multiplexing e Local Worker;
- repetir `npm ci` quando o target/lockfile exigir, `npm run contract:reconcile` na branch dedicada,
  e contraprovas fora do harness puramente simulado no Windows;
- Security Review independente GREEN sobre o candidate completo antes de qualquer integração;
- congelar candidate somente após diagnóstico → RED → correção → contraprova → regressão completa.

Continuidade: SESSION_REUSE_BY_DEFAULT. O Executor Luna high permanece na mesma sessão durante
diagnóstico, implementação, correções e congelamento. Sessão nova somente para Security Reviewer
independente e Reviewer/Auditor independentes quando o contrato exigir. O Executor retorna apenas
com blocker arquitetural real ou candidate completo pronto para o próximo gate.
```

- resultado PRE_DISPATCH: autorizado para handoff ao Executor persistente nesta branch, com `nextPrId=P4-PR04`, `nextAuthorizedAction=START_P4_PR04`, worktree limpa e dependências satisfeitas.

## P4-PR04 — candidate local multi-session stream

- base fixa: `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`; kickoff: `6f593eab2b843220572d4849c6f1ff1ab8e3a6ee`; branch: `mvo/p4-pr04-multi-session-stream`; execução somente em `D:\Morrow`;
- implementação: `src/worker-session-stream.ts` compõe `TerminalSessionManager`, `StreamRedactor` e `JsonlEventLog`; não cria runtime paralelo, transporte externo ou dependência de UI. Schema: `schema/worker-session-stream.v1.schema.json`; contrato factual: `runtime/MULTI_SESSION_STREAM_API.md`;
- RED inicial: antes da nova composição, `test/worker-session-stream.test.ts` falhou com `ERR_MODULE_NOT_FOUND` para `src/worker-session-stream.ts`. REDs de composição encontrados em seguida: conclusão do terminal resolvia antes da persistência do tail/EXIT e argumentos sensíveis apareciam no evento START; ambos foram corrigidos antes do congelamento;
- GREEN central: duas sessões reais Node simultâneas (`T-A`/`T-B`) em workspaces distintos emitiram saída incremental antes do término, com listeners por sessão, ids `${sessionId}:${sequence}`, streams distintos, replay do início/intermediário/head, cursor estrangeiro/hostil/future/stale explícitos, sem duplicação/perda, e reidratação terminal após reopen;
- P2 de durabilidade de completion: RED causal reproduziu START durável seguido de indisponibilidade do `append` terminal; o candidate anterior resolvia `completion` com sucesso apesar de live `failed` e reopen apenas `recoverable/offline`. A correção preserva o erro sanitizado na sessão e faz `start().completion` rejeitar `worker_session_terminal_persistence_failed` após a fila; GREEN confirma que não há sucesso terminal sem evento terminal durável e que reopen não fabrica EXIT;
- restart de sessão incompleta: processo real ainda ativo foi fechado do observador e reaberto; o log durável foi reconstruído como `recoverable`/`offline`/não terminal, sem convertê-lo em completed. Sessões encerradas permaneceram `completed`/`terminal`;
- redaction: o mesmo `StreamRedactor` bounded protege argumentos START e stdout/stderr antes de live e Event Log; replay/reopen retornam os mesmos fragmentos redigidos e o canário não aparece no evento público. Observador que lança exceção não altera persistência nem outro stream;
- focused P4-PR04: `5/5` após o fix, com a contraprova de durabilidade; a execução anterior `4/4` foi repetida cinco vezes sem flakiness. Focused regressões terminal/multiplexing, Live Activity, transcript, P4-PR03, recovery, Local Worker e governance: `156/156`;
- regressão completa final: `npm test` `256/256` GREEN, após tentativas concorrentes intermediárias que apresentaram somente falhas ambientais/intermitentes pré-existentes (`EBADF`, `EBUSY` e isolamento/colisão do probe ConPTY); focused P4-PR03 isolado `29/29` e agregada relevante `156/156` GREEN. `git diff --check` e `npm run contract:reconcile` são registrados no worktree limpa após o commit; nenhum teste alterou código fora da allowlist. D-013 não apareceu e permanece fora desta PR; nenhum finding P1/P2/P3 novo. Findings informacionais herdados permanecem inalterados;
- estado histórico no candidate antes da reconciliação: pendente de commit final e Security Review independente.

## P4-PR04 — Security Review GREEN e handoff ao Reviewer

- candidate HEAD congelado: `8c89bf7af2fc5609cc02acf70966098b3c6261e1`; base: `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`; kickoff/control root de abertura: `6f593eab2b843220572d4849c6f1ff1ab8e3a6ee`; branch: `mvo/p4-pr04-multi-session-stream`;
- veredito independente: `SECURITY_REVIEW_GREEN — P4_PR04_READY_FOR_INDEPENDENT_REVIEW`; o Security Reviewer foi read-only, em sessão independente, deixou worktree limpa, não alterou o candidate e não fez push, PR, merge ou deploy;
- escopo do Security Review: focused P4-PR04 `5/5`; regressões relacionadas `121/121`; `git diff --check` GREEN; `npm run contract:reconcile` `allowed=true`, `state=READY_FOR_EXECUTION`; nenhum finding P1/P2;
- contraprova causal de persistência terminal: a indisponibilidade do append terminal fez `completion` rejeitar com `worker_session_terminal_persistence_failed`; a sessão viva ficou `failed`, o reopen ficou `recoverable`/`offline`, o replay reteve somente `STARTED`, a sessão B não foi afetada e não houve unhandled rejection/deadlock;
- evidência do Executor preservada: focused P4-PR04 `5/5`, regressões das superfícies tocadas `156/156`, `npm test` `256/256`, focused P4-PR03 `29/29`, D-013 ausente e fora do escopo; falhas intermediárias foram ambientais/intermitentes pré-existentes e não alteraram o resultado final;
- estado contratual: P4-PR04 permanece `RUNNING`; candidate está `FROZEN_FOR_INDEPENDENT_REVIEW`; não há autorização de integração/merge e nenhum PR foi aberto;
- próximo ator único: Reviewer independente P4-PR04, sessão nova e read-only, conferindo candidate completo, Security Review, execution/control roots, escopo, cobertura, regressão e limites. Esta entrada não declara `PROVEN`.

## P4-PR04 — Independent Reviewer BLOCKED e retorno ao Executor

- objeto revisado: candidate `8c89bf7af2fc5609cc02acf70966098b3c6261e1`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`, Control Root documental `d1c4242897540167211d7d850ecdad514e48053c`;
- resultado recebido do Reviewer independente: `REVIEW_BLOCKED` por classes `technical`, `coverage` e `environment`; o Reviewer permaneceu read-only e não promoveu o candidate a `PROVEN`;
- lacuna confirmada no disco: `src/worker-session-stream.ts` importa `TerminalSessionManager`, `StreamRedactor` e `JsonlEventLog`, mas não compõe `LiveActivity`, `PersistentTranscriptStore`, snapshot ou `WorkerRecoveryCoordinator`, exigidos pela TASK em `EVIDENCE.md:357-386` para live, replay, disco e reopen;
- focused independente reportado: `1/5`; quatro casos falharam antes do harness por `EPERM` em `mkdtemp`/`TEMP`. A cobertura comportamental permanece inconclusiva e o resultado não é GREEN;
- consequência: a Security Review GREEN anterior permanece evidência do escopo que revisou, mas não satisfaz a cobertura da unidade quando a composição exigida está ausente. O candidate permanece bloqueado, sem PR, push, merge ou deploy;
- rota autorizada: `START_P4_PR04` continua coarse; o próximo ator único é o Executor P4-PR04 persistente, na mesma unidade e branch, para integrar somente as primitivas já provadas, criar RED/contraprovas, resolver o bloqueio ambiental sem mascará-lo e repetir as regressões antes de novo Reviewer;
- nenhum owner decision é necessário: destino, escopo mestre, contrato e ordem das PRs não mudam. Esta reconciliação não altera `CONTRACT.md` ou `TARGET.md` e não é mudança técnica.

## Registro anterior — P4-PR04 candidate b1347fe congelado e Security Review pendente

- transição mecânica do Relay: `pendingCandidateSha=b1347fe004355eca8615c4f7662d77de7ee6f294`, `pendingCandidateUnitId=P4-PR04`; candidate congelado no mesmo branch e na mesma unidade;
- commit candidate: `b1347fe004355eca8615c4f7662d77de7ee6f294`, mensagem `candidate(p4-pr04): freeze executor result`, com alteração somente em `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`;
- a composição ausente no candidate anterior agora está presente no delta técnico: imports/uso de `PersistentTranscriptStore`, `WorkerRecoveryCoordinator`, `projectContractLiveActivity`, `WorkerSessionSnapshot`, transcript por sessão e live activity por sessão;
- o candidate `8c89bf7af2fc5609cc02acf70966098b3c6261e1` e seu blocker anterior ficam preservados como histórico; não são o objeto atual de Security Review;
- estado atual: P4-PR04 `RUNNING`, candidate `FROZEN_FOR_SECURITY_REVIEW`, Security Review independente `PENDING`; nenhum teste, contraprova de segurança, PR, push, merge ou deploy é declarado por esta reconciliação;
- próximo ator único: Security Reviewer independente, sessão nova e read-only, revisando exatamente o candidate `b1347fe004355eca8615c4f7662d77de7ee6f294`; `START_P4_PR04` permanece coarse e não autoriza integração;
- `CONTRACT.md`, `TARGET.md` e a ordem das 42 PRs não foram alterados; nenhuma decisão do dono é necessária.

## Registro anterior — P4-PR04 candidate 42146b1 congelado e Security Review pendente

- transição mecânica do Relay: `pendingCandidateSha=42146b10350ebacb778ffbbfba93500eb93bd7dd`, `pendingCandidateUnitId=P4-PR04`; candidate congelado no mesmo branch e na mesma unidade após recuperação de Git do Executor;
- commit candidate `42146b10350ebacb778ffbbfba93500eb93bd7dd`, mensagem `candidate(p4-pr04): freeze executor result`, com alteração somente em `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`;
- `b1347fe004355eca8615c4f7662d77de7ee6f294` e o blocker anterior ficam preservados como histórico; não são o objeto atual de Security Review;
- estado atual: P4-PR04 `RUNNING`, candidate `FROZEN_FOR_SECURITY_REVIEW`, Security Review independente `PENDING`; nenhum resultado de teste, contraprova de segurança, PR, push, merge ou deploy é declarado por esta reconciliação;
- próximo ator único: Security Reviewer independente, sessão nova e read-only, revisando exatamente `42146b10350ebacb778ffbbfba93500eb93bd7dd`; `START_P4_PR04` permanece coarse e não autoriza integração;
- `CONTRACT.md`, `TARGET.md` e a ordem das 42 PRs não foram alterados; nenhuma decisão do dono é necessária.

## Registro anterior — P4-PR04 candidate 2ab1968 congelado e Security Review pendente

- transição mecânica do Relay: `pendingCandidateSha=2ab1968fe654223bb727ce55e90ffef2d5f77948`, `pendingCandidateUnitId=P4-PR04`; candidate congelado no mesmo branch e na mesma unidade após recuperação de Git do Executor;
- commit candidate `2ab1968fe654223bb727ce55e90ffef2d5f77948`, mensagem `candidate(p4-pr04): freeze executor result`, com alteração somente em `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`;
- `42146b10350ebacb778ffbbfba93500eb93bd7dd` e o blocker anterior ficam preservados como histórico; não são o objeto atual de Security Review;
- estado atual: P4-PR04 `RUNNING`, candidate `FROZEN_FOR_SECURITY_REVIEW`, Security Review independente `PENDING`; nenhum resultado de teste, contraprova de segurança, PR, push, merge ou deploy é declarado por esta reconciliação;
- próximo ator único: Security Reviewer independente, sessão nova e read-only, revisando exatamente `2ab1968fe654223bb727ce55e90ffef2d5f77948`; `START_P4_PR04` permanece coarse e não autoriza integração;
- `CONTRACT.md`, `TARGET.md` e a ordem das 42 PRs não foram alterados; nenhuma decisão do dono é necessária.

## Registro anterior — P4-PR04 candidate 98a32e7 congelado e Security Review pendente

- transição mecânica do Relay: `pendingCandidateSha=98a32e7a7184801c855572bbb67192d4b1ec98a2`, `pendingCandidateUnitId=P4-PR04`; candidate congelado no mesmo branch e na mesma unidade após recuperação de Git do Executor;
- commit candidate `98a32e7a7184801c855572bbb67192d4b1ec98a2`, mensagem `candidate(p4-pr04): freeze executor result`, com alteração somente em `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`;
- `2ab1968fe654223bb727ce55e90ffef2d5f77948` e o blocker anterior ficam preservados como histórico; não são o objeto atual de Security Review;
- estado atual: P4-PR04 `RUNNING`, candidate `FROZEN_FOR_SECURITY_REVIEW`, Security Review independente `PENDING`; nenhum resultado de teste, contraprova de segurança, PR, push, merge ou deploy é declarado por esta reconciliação;
- próximo ator único: Security Reviewer independente, sessão nova e read-only, revisando exatamente `98a32e7a7184801c855572bbb67192d4b1ec98a2`; `START_P4_PR04` permanece coarse e não autoriza integração;
- `CONTRACT.md`, `TARGET.md` e a ordem das 42 PRs não foram alterados; nenhuma decisão do dono é necessária.

## P4-PR04 — candidate a6aee3e congelado e Security Review pendente

- transição mecânica do Relay: `pendingCandidateSha=a6aee3e90a6af810ce52a425a6e16ea6281b54a7`, `pendingCandidateUnitId=P4-PR04`; candidate congelado no mesmo branch e na mesma unidade após recuperação de Git do Executor;
- commit candidate `a6aee3e90a6af810ce52a425a6e16ea6281b54a7`, mensagem `candidate(p4-pr04): freeze executor result`, com alteração somente em `src/worker-session-stream.ts` e `test/worker-session-stream.test.ts`;
- `98a32e7a7184801c855572bbb67192d4b1ec98a2` e o blocker anterior ficam preservados como histórico; não são o objeto atual de Security Review;
- estado atual: P4-PR04 `RUNNING`, candidate `FROZEN_FOR_SECURITY_REVIEW`, Security Review independente `PENDING`; nenhum resultado de teste, contraprova de segurança, PR, push, merge ou deploy é declarado por esta reconciliação;
- próximo ator único: Security Reviewer independente, sessão nova e read-only, revisando exatamente `a6aee3e90a6af810ce52a425a6e16ea6281b54a7`; `START_P4_PR04` permanece coarse e não autoriza integração;
- `CONTRACT.md`, `TARGET.md` e a ordem das 42 PRs não foram alterados; nenhuma decisão do dono é necessária.

## 2026-11-25 — P4-PR04 Security Review BLOCKED (retorno ao Executor)

Parecer independente recebido do Security Reviewer via operador, realizado exclusivamente por DC, candidate `a6aee3e90a6af810ce52a425a6e16ea6281b54a7`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`. Veredito `BLOCKED`; a conclusao abaixo e relato do revisor, ainda nao reproduzida pelo Cerebro.

- P2-01: canario sintetico exposto no retorno de conclusao em stdout e stderr.
- P2-02: apos fechamento do stream, retorno `completed` sem evento terminal duravel.
- P2-03: transcript expoe registros de outro agente do mesmo contrato.
- P2-04: `T-Case` e `t-case` aceitas com mesmo streamId no Windows, invalidando replay de uma sessao.
- Focused 11/11 GREEN, incluindo processos simultaneos reais e reidratacao; regressao completa RED: tres falhas (EBUSY, EPERM e redaction SGR nao diagnosticada), um teste ignorado; diff-check GREEN, Git limpo e dependencias preservadas, segundo o revisor.
- Limitacao: impedimentos ambientais e regressao SGR nao resolvidos; nenhum log bruto ou contraprova executavel foi fornecido ao Cerebro nesta devolutiva. Nao promover a prova a GREEN.

Retorno autorizado ao Executor persistente, apos PRE_DISPATCH: reproduzir e corrigir os quatro P2 no mesmo lote; diagnosticar EBUSY/EPERM, SGR e teste ignorado; contraprovar cada falha e executar regressao cumulativa. Alterar apenas superficies causalmente necessarias, sem refactor lateral, sem relaxar controles/testes, sem novas dependencias. Registrar RED/GREEN, evidencias e checkpoint; congelar novo candidate e devolver ao Security Reviewer independente read-only. P4-PR04 permanece RUNNING; nenhum push, PR, merge, deploy ou P5 autorizado.

## 2026-11-25 — P4-PR04 recuperacao causal: PRE_DISPATCH e RED

- Executor via DC, D:\Morrow, HEAD `110a62a93e5c710f42c21d70fccda97639b6789a`, branch dedicada, worktree limpa na abertura, base ancestral `78e1bfdc`; reconciliador `READY_FOR_EXECUTION` / `START_P4_PR04`, Node v24.14.1.
- Baseline cumulativa real: 262 testes, 260 PASS, 1 FAIL (`D-015`, EPERM ao criar symlink), 1 SKIP (snapshot simbolico/junction ancestral, EPERM). SGR PASS e EBUSY nao reproduzido nesta rodada. Token DC nao elevado, sem `SeCreateSymbolicLinkPrivilege`; nenhuma configuracao global alterada.
- Contraprovas individuais novas em `test/worker-session-stream.test.ts`: RED 0/4, confirmando canario em completion, `completed` sem EXITED apos close, transcript de outro agente e alias `t-case` aceito. Logs brutos em `.morrow-test-tmp/p4-pr04-recovery/baseline-full.log` e `p2-red.log`.
- P4-PR04 continua RUNNING/BLOCKED, sem autorizacao de integracao. Proximo: correcoes causais e contraprovas combinadas, sem relaxar testes.

## 2026-11-25 - P4-PR04 checkpoint intermediario: correcoes aplicadas, prova pendente

Executor reportou reproducao 4/4 e aplicacao das quatro correcoes; Cerebro conferiu via DC HEAD 110a62a, alteracoes nao commitadas nos dois arquivos tecnicos, registros RED e falha EPERM no log. Nenhum novo candidate congelado. Baseline reportada: 260 PASS, 1 FAIL, 1 SKIP; SGR passou, EBUSY nao reproduzido, EPERM em symlink. Contraprovas pos-correcao, combinadas e regressao integral pendentes. O candidate anterior permanece bloqueado; P4-PR04 RUNNING. Proximo ator: mesmo Executor, concluir as validacoes e diagnostico ambiental, atualizar evidencias e devolver READY_FOR_FREEZE ou BLOCKED. Nao congelar nem integrar ate autorizacao. Nao iniciar P5.

## 2026-11-25 - P4-PR04 recuperacao: contraprovas pos-correcao

- Retomada DC no HEAD `110a62a`, preservando todas as quatro correcoes. Primeiro focused: 13/15; duas expectativas incompatíveis com comportamento seguro (teste antigo aguardava completion bem-sucedida apos close; canario colado ao token era integralmente redigido pelo redator canonico). Teste de restart agora exige rejeicao e comprova que o processo real concluiu; prova de redaction exige preservacao de texto seguro separado e ocultacao do token composto. Nenhum controle de produto relaxado.
- Focused apos alinhamento: 17/17, zero FAIL/SKIP (`focused-recovery.log`). 4/4 contraprovas individuais, combinada com dois PIDs reais simultaneos, alias bloqueado, transcript estrangeiro filtrado, falha transitoria de append com erro sanitizado, nenhuma persistencia terminal apos lacuna, replay e novo processo Node de reidratacao; corrida de aliases entre contratos permite exatamente um start. Completions seguras, cursores isolados, estado offline/recoverable apos restart, sessao B concluida.
- Probe nativo `windows-links.log`: symlink de arquivo EPERM, junction criada e identificada como link. Token sem `SeCreateSymbolicLinkPrivilege`; nenhuma mudanca global, elevacao ou substituicao simulada. Separei a prova junction ancestral da prova symlink de arquivo; a antiga omissao foi removida para que EPERM seja falha explicita obrigatoria, sem fingir prova. O teste D-015 permanece intacto.
- Cumulativa integral pendente de nova execucao. Candidato antigo continua bloqueado, nenhum freeze/commit/push/merge/P5.

## 2026-11-25 - P4-PR04 recuperacao: regressao e EBUSY

- Primeira cumulativa pos-correcao (`recovery-full.log`): 269 testes, 265 PASS, 4 FAIL, zero SKIP. Os 17 testes P4-PR04, SGR, junction ancestral e D-015 same-size race passaram. Dois EPERM ocorreram na criacao nativa de file symlink (D-015 e transcript); dois EBUSY ocorreram apenas em rmdir de fixtures ConPTY.
- Corrigida exclusivamente a limpeza das cinco fixtures de `test/codex-conpty-adapter.test.ts`, com maxRetries=5/retryDelay=100; nenhuma assercao ou codigo ConPTY alterado. A limpeza continua obrigatoria e falha se o diretorio nao puder ser removido. Os dois diretorios temporarios da rodada anterior foram efetivamente removidos (`ebusy-cleanup.log`). Focused ConPTY quota adapter `6/6 PASS`, zero FAIL/SKIP (`conpty-cleanup-focused.log`).
- Apos reconexao DC, HEAD permanece `110a62a` e as correcoes estao preservadas. Proximo: repetir cumulativa integral apos ajuste de limpeza, manter file symlinks obrigatorios e registrar veredito. Sem freeze, commit, push, merge ou P5.

## 2026-11-25 - P4-PR04 recuperacao: SGR e sincronizacao de restart

- Cumulativa apos ajuste EBUSY (`recovery-full-final.log`): 269 testes, 264 PASS, 5 FAIL, 0 SKIP. EBUSY nao reapareceu; ambos ConPTY antes afetados passaram. Restaram dois EPERM de criacao de file symlink, um falso RED SGR e duas provas de restart dependentes de timers (800/1000 ms), que podiam expirar antes do commit duravel sob carga.
- SGR: `allFileText` decodificava inclusive `.transcript-redaction-key` (32 bytes binarios aleatorios); reproduzi deterministicamente o falso RED com chave sintetica contendo 0x1B somente em fixture isolada vazia (`sgr-fixture-red.log`, 0/1). A prova corrigida verifica a chave binaria intacta, exclui exclusivamente esse arquivo do exame de texto, exige ausencia de ESC bruto e escapado no restante, preserva 'hello' em live/inspect/disco e reabre o transcript. GREEN 1/1 (`sgr-fixture-green.log`). Nenhum codigo funcional do redator alterado.
- As duas provas de restart agora mantem o processo real aguardando stdin, confirmam estado running antes/depois do close, liberam explicitamente o processo e exigem erro sanitizado na completion sem evento terminal duravel, bem como estado recoverable/offline apos reopen. Focused integral P4-PR04 17/17 PASS, zero FAIL/SKIP (`focused-recovery-barrier.log`), incluindo contraprovas individuais, combinadas e adversariais. Nenhuma alteracao adicional nas quatro correcoes de produto.
- Proximo: cumulativa integral final apos estabilizacao das fixtures. EPERM continua barreira nativa sem alteracao global ou elevacao autorizada; nenhuma prova simulada substitui a real. Sem freeze/commit/push/merge/P5.

## 2026-11-25 - P4-PR04 recuperacao: veredito final BLOCKED (ambiental)

- Cumulativa integral final apos estabilizacao (`recovery-full-stabilized.log`, exit 1): 269 testes, 267 PASS, 2 FAIL, zero SKIP/CANCELLED/TODO; 108090.5598 ms. Todos os 17 testes P4-PR04 passaram na cumulativa, assim como SGR, ConPTY quota, junction ancestral, D-015 same-size race, replay grande de 200 eventos, isolamento, persistencia e restart. Nenhum EBUSY nesta rodada. As duas falhas restantes ocorrem antes da assercao de seguranca: syscall `symlink` EPERM (D-015 em `test/p4-pr03-replay.test.ts:135` e snapshot em `test/stream-transcript.test.ts:1499`). A fixture nativa confirmou ausencia de privilegio para file symlink e sucesso de junction. Nao ha evidencia de regressao funcional nesses dois casos; tampouco ha GREEN para as provas obrigatorias.
- Logs brutos e exit codes preservados em `.morrow-test-tmp/p4-pr04-recovery/`, inventario SHA256 em `SHA256SUMS.txt`. SHA256 da cumulativa final: `6FEC335BE7851625E8AC2116B2C96C6A0B1A7A9FE7D98957DB7D3C85E72DEDAF`; focused final 17/17: `2A4016920E5E3FB2753244BDAEB6853547D6A6980E407E0164A43F3E66E35848`. Diff-check exit 0; package.json e package-lock.json sem delta contra `78e1bfdc`. HEAD segue `110a62a`, branch dedicada; alteracoes preservadas no worktree, nao staged. Nao foram alterados controles funcionais de P3, redator ou event log; ajustes de harness ConPTY/SGR/restart causais, sem suprimir assercoes. Nenhuma configuracao global, elevacao ou permissao alterada.
- Veredito `BLOCKED`: requer execucao nativa dos dois testes de file symlink sob autorizacao de permissao adequada, seguida de cumulativa integral verde. Nao congelar nem fazer commit, push, PR, merge, deploy ou P5. Proximo ator Executor persistente apos autorizacao do Cerebro/operador. Candidato anterior continua SECURITY_REVIEW_BLOCKED; novo candidato ainda inexiste.

## 2026-11-25 - Cerebro: verificacao do bloqueio ambiental e decisao pendente

Conferencia read-only via DC: hashes SHA256 da regressao integral e focused coincidem com EVIDENCE; log confirma 267 PASS, 2 FAIL na syscall symlink e zero SKIP. Probe nativo confirma file symlink EPERM e junction GREEN; whoami /priv nao lista SeCreateSymbolicLinkPrivilege. Diff-check GREEN; sem delta nos package files. Estado segue RUNNING/BLOCKED, sem freeze. Proposta sujeita a autorizacao explicita do operador: executar apenas os testes necessarios do Morrow em processo temporario com permissao adequada, sem elevar o DC inteiro, alterar configuracoes globais ou tocar outros projetos. Registrar prova nativa, regressao e contexto de permissao; nenhuma aprovacao ou permissao foi concedida nesta verificacao.

## 2026-11-25 - Autorizacao do operador: elevacao temporaria restrita aos testes P4-PR04

Operador confirmou explicitamente a proposta do Cerebro apos esclarecimento do significado e risco da elevacao. Autorizacao unica e limitada: via DC, em D:\Morrow, usar processo temporario com permissao suficiente para criar file symlinks nos dois testes obrigatorios e, se necessario, executar a regressao cumulativa do mesmo candidato. Preferir menor privilegio e usar aprovacao UAC normal quando exigida; nao elevar o DC inteiro, nao contornar UAC, nao alterar politicas, Developer Mode, privilegios permanentes, dependencias ou outros projetos. Encerrar o processo elevado ao terminar; preservar a prova de 267 PASS sem elevacao. Executor persistente deve verificar o escopo e os comandos antes de executar, registrar contexto de permissao, logs, exit codes, hashes, zero SKIP e regressao, e devolver READY_FOR_FREEZE ou BLOCKED. Se UAC exigir interacao, solicitar ao operador apenas a aprovacao necessaria. P4-PR04 continua RUNNING, candidate anterior BLOCKED; sem commit, freeze, push, PR, merge, deploy ou P5 ate nova ordem. Esta autorizacao nao constitui evidencia de teste executado.

## 2026-11-25 - P4-PR04 prova nativa elevada e controle ConPTY

- Autorizacao explicita do operador para processo elevado temporario somente de testes, via DC. PID 28316 elevado confirmado; DC nao elevado. D-015 e snapshot file symlink: 1/1 cada, exit 0, zero SKIP. Cumulativa elevada default: 269 testes, 267 PASS, 2 FAIL, zero SKIP. Ambos file symlinks passaram tambem na cumulativa. Falhas: lifecycle ConPTY timeout de execFile 12s e multiplex ConPTY EBUSY no rmdir da fixture W-R3-timeout. Worker/launcher exit 1, PID 28316 encerrado as 22:21:04; sem processos relacionados aos fixtures identificados na consulta posterior. Evidencias brutas e hashes em `.morrow-test-tmp/p4-pr04-recovery/elevated-run-01/`; SHA256 full.log `28757FBDA813EF48B01D34E3C2A4157B8A26B988F3407B25E6698D2949E6AD67`.
- Controle focused nao elevado dos dois testes: 0/2, ambos EBUSY no rmdir de fixtures, preservado em `conpty-elevation-retry-focused.log`. Contraprova direta nao elevada lifecycle: exit 0, naturalExitCode 7, 524288 bytes drenados, PIDs 18380 e 8396 ausentes apos execucao. Multiplex direto: exit 0, 3 rodadas, 12 sessoes, 6 completed/3 timedOut/3 stopped, 12 PIDs distintos de cada classe, 51 eventos, inputIsolation/noOrphans/fixtureRemoved true. Logs `conpty-lifecycle-direct.*` e `conpty-multiplex-direct.*`. Indicio de intermitencia ambiental, nao evidencia suficiente para declarar a cumulativa GREEN.
- Proxima prova: nova cumulativa elevada temporaria, mesma lista integral do script npm test, `--test-concurrency=1` para eliminar concorrencia entre arquivos, sem alterar timeouts, assercoes, teste de sessoes simultaneas ou codigo. Logs separados; encerra o worker ao terminar. Sem freeze/commit/push/merge/P5.

## 2026-11-25 - P4-PR04 veredito READY_FOR_FREEZE: cumulativa integral GREEN

- Cumulativa elevada serial (`elevated-run-02/full.log`): 269 testes, 269 PASS, 0 FAIL/CANCELLED/SKIP/TODO; 159867.6149 ms. Comando equivalente ao script `npm test` com `--test-concurrency=1` para controlar contencao entre arquivos, sem alterar conjunto de casos, limites, controles ou concorrencia real intrateste. D-015 file symlink, snapshot simbolico, SGR, lifecycle/multiplex ConPTY e os 17 testes P4-PR04 GREEN. Primeira cumulativa elevada default 267/269 e focused ConPTY RED 0/2 foram preservados, seguidos de contraprovas diretas GREEN; nao se afirma eliminacao definitiva da intermitencia EBUSY/timeout sob carga. Nenhuma mudanca de codigo nesta rodada.
- SHA256 `elevated-run-02/full.log`: `7851D4E2E4B22FB3DC989A9DE293D234D9612394CA029822FB0EC73173A14B35`; `full.exit`, `worker.exit`, `launcher.exit` = 0; inventario `elevated-run-02/SHA256SUMS.txt`. Hash da cumulativa sem elevacao `6FEC335BE7851625E8AC2116B2C96C6A0B1A7A9FE7D98957DB7D3C85E72DEDAF` e da primeira elevada `28757FBDA813EF48B01D34E3C2A4157B8A26B988F3407B25E6698D2949E6AD67` reconferidos intactos. Hashes das provas diretas/focused ConPTY em `CONPTY-ELEVATION-CONTROLS-SHA256.txt`.
- Elevacao UAC normal restrita aos testes: PID 28316 encerrou 22:21:04; PID 4756 encerrou 22:26:18.4135759-03:00; ambos ausentes apos as provas e DC confirmado nao elevado. Nenhuma politica, Developer Mode, privilegio permanente ou dependencia alterada. HEAD `110a62a`, branch `mvo/p4-pr04-multi-session-stream`, diff-check 0 e package files identicos a base `78e1bfdc`. Alteracoes anteriores preservadas, nenhum commit/freeze/push/merge/P5. Autorizacao temporaria encerrada. `READY_FOR_FREEZE` exclusivamente para o worktree recuperado; o candidate anterior segue BLOCKED. Aguardar ordem do Cerebro/operador para congelar e submeter Security Review independente.

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

## 2026-11-25 - P4-PR04 recuperacao c7b905a: PRE_DISPATCH e RED

- DC exclusivo, HEAD `c7b905a4bb451b3c82ca3bfc207bae16b30fec26`, Git limpo na abertura, reconciliador READY_FOR_EXECUTION/START_P4_PR04. Parecer independente SHA256 `661D35992576A2EA1779D69F55722FB3AAB3BC4BD269F8D2A50B22767E3A384A` confirmado. Nenhum processo externo de testes Node identificado na consulta inicial. Autorizacao UAC anterior consumida.
- Quatro contraprovas RED permanentes em test/worker-session-stream.test.ts: 0/4, zero SKIP (new-findings-red.log, exit 1, `.morrow-test-tmp/p4-pr04-recovery-c7b905a/`). P2-05: 5 vetores de argumentos sensiveis separados vazam inclusive apos restart; P2-06: snapshot historico associa outro contrato; P2-07: novo ciclo com identidade historica torna reopen invalido; P3-01: duas sessoes ConPTY reais entregam terminal, mas flush publico classifica stdout. TranscriptStream tambem nao aceita terminal em seus validadores. Proximo: correcoes causais conjuntas, contraprovas e regressao sem testes externos concorrentes. Sem freeze/P5.

## 2026-11-25 - P4-PR04 recuperacao c7b905a: correcoes causais e diagnosticos

- P2-05: redactor canonico examina membros e contexto completo do argv; quando sensivel, mascara vetor inteiro para nao expor valores separados/multiplas palavras. P2-06/07: snapshot e completion exigem identidade completa, vinculo admitido nesta vida e estado duravel correspondente; logs reidratados nao recebem novos eventos de manager, alias ou identidade exata. Gate de admissao impede gravacao durante reserva concorrente ainda nao confirmada; lifecycle recusa START/EXIT duplicados; replay usa mesma fila, verifica head e identidade/payload persistidos; transcript filtra tambem step/writer. P3-01: redator independente por stdout/stderr/terminal e validacao TranscriptStream na entrada/reopen; nenhuma politica do redator enfraquecida.
- Focused inicial 20/21, quatro novos achados passaram exceto expectativa de marcador seguro em ConPTY: redactor canonico mascara linhas com controles VT mutantes. Diagnostico nativo mostrou mascaramento integral tanto no completion quanto no stream. Prova reforcada com captura raw sintetica, comparacao exata ao redactor canonico, transcript/replay/reopen e dois PIDs reais: native-green 1/1 PASS; nao se exige relaxar politica ANSI. Quatro P2 anteriores e todos os 17 testes anteriores GREEN na primeira rodada.
- EBADF: `fd-ownership-probe.log` reproduziu 8/8 fechamento duplo de fd pelo ReadStream.destroy e FileHandle.close apesar de autoClose:false, exatamente o padrao de EventLog.scan. Corrigido para leitura de chunks 64 KiB por um unico FileHandle; limites, checks, HMAC e lstat/stat preservados; close falho nao suprimido. Regressao pendente.
- Bootstrap: 12/12 retries naturais GREEN antes da correcao, mas prova deterministica com dois processos e barreira na criacao wx reproduziu key event_log_authority_unavailable e binding event_log_authority_binding_invalid (bootstrap-publication-red 0/1). Arquivos completos e flushed agora publicados por hard link exclusivo, temporario unico removido, perdedor le vencedor; se historico aparece durante ENOENT/readdir, so rele chave existente, nao recria. Suite governance `bootstrap-green.log` 24/24 PASS zero skip, inclusive prova nova e recusa de rebootstrap apos perda da chave. Nenhuma configuracao global/dependencia alterada.
- ConPTY: logs anteriores confirmam EBUSY no teardown de lifecycle e multiplex; adicionados retries nativos limitados 5 x 100ms nas tres remocoes respectivas, escopo, noOrphans, fixtureRemoved e timeouts preservados; nenhuma mudanca backend. Proximo: contraprovas adversariais adicionais e regressao sequencial isolada. Logs em `.morrow-test-tmp/p4-pr04-recovery-c7b905a/`; nenhuma elevacao nova, freeze ou P5.

## 2026-11-25 - P4-PR04 c7b905a: focused final GREEN e gate de isolamento do host

- `focused-green-final.log` 23/23 PASS, zero FAIL/SKIP, exit 0: 17 casos anteriores preservados, 4 novos RED/GREEN, 2 adversariais adicionais (reserva concorrente rejeitada sem incorporar lifecycle externo; observacao externa nova sanitizada inclusive indice explicito; step estrangeiro excluido; append autenticado fora do lifecycle recusado em replay/reopen). Suite governance 24/24. API documental atualizada sem mudanca adicional de codigo funcional.
- Preflight da cumulativa as 22:47 detectou teste MKT em execucao (PIDs 20756/11504, job externo `20261125-224647-c2b72654`), bloqueou antes de iniciar Morrow. Nova consulta as 22:48 encontrou PID MKT 18240. Nenhum processo externo encerrado ou modificado; DC permanece nao elevado e sem privilegio nativo file symlink. Cumulativa deve iniciar somente sem testes externos e registrar monitoramento. Nenhuma nova autorizacao UAC usada.


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

## 2026-11-26 - P4-PR04 Security Review BLOCKED e recuperacao por invariantes

Parecer independente .morrow-test-tmp/p4-pr04-review-6372857/SECURITY_REVIEW_BLOCKED.md, SHA256 E2335A293DEAB772575753D3CDBA3F8BFF7C60F52A9D3F17F867F7512986E360, candidate `6372857cb645f994d31125bdb4ed8baef97591c8`, base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`. Cerebro conferiu parecer, contrato/AC-16/20/23, API e Git limpo via DC; reproducoes sao do Reviewer. P2-01..07 e P3-01 GREEN; novos P2-08 eco de argumento explicitamente sensivel em saidas; P2-09 mutacao de evento terminal por observador; P2-10 payload autenticado estruturalmente invalido aceito; P2-11 perda de log permite efeito repetido; P2-12 transicao de binding nao atomica; P3-02 falha de lancamento nao duravel. Cumulativa independente 274/276, exit 1 (dois EPERM antes da assercao), zero SKIP; estresse 64/64 exit 0, sem ConPTY/EBADF/EBUSY reproduzidos. A prova de 276/276 anterior segue historica sem exit direto. Nenhuma nova elevacao autorizada.

### Estrategia de fechamento dentro da mesma unidade (sem novo gate contratual)
Antes de editar, Executor deve mapear os fluxos reais de start, observacao, persistencia, replay e reopen, localizar causas comuns, confrontar as 14 provas e registrar uma matriz curta de invariantes/contraprovas no EVIDENCE. Nao repetir abordagem de patch por sintoma. Aplicar a menor correcao causal nos limites existentes; reutilizar primitivas provadas e um unico criterio canonico por limite quando viavel. Sem reescrever runtime, trocar storage, adicionar dependencias, UI, rede, Nexus ou nova autoridade. Corrigir modulos anteriores apenas se a causalidade for demonstrada para P4-PR04; preservar APIs/invariantes aceitos e regressao herdada.

I1 - Confidencialidade (AC-16): entradas explicitamente sensiveis e eco do processo protegidos pela politica canonica em todos os canais, eventos, erros, completion, disco e reabertura; canarios sinteticos, inclusive fragmentados, sem perder saida segura indevidamente. P2-01/05/08, P3-01.
I2 - Identidade e admissao: identidade completa e unica, reserva antes do efeito, vinculo da vida corrente; historico conhecido nao pode reexecutar, inclusive alias, log ausente ou inconsistencia entre ancoras ja existentes; fail-closed sem ampliar o modelo de ameaca para perda total de toda autoridade. P2-03/04/06/07/11.
I3 - Eventos e estado (AC-20): copia canonica isolada de observadores, schema semantico exato por tipo, estados/transicoes e resultados coerentes; mesma validacao antes de persistir/publicar e no replay/reopen; HMAC nao substitui validacao. Rejeitar evento malformado, duplicado ou mutado, sem conclusao fabricada. P2-02/07/09/10, P3-02.
I4 - Durabilidade e recuperacao: falha de lancamento, timeout, close, append falho, restart, perda de log e transicao de autoridade preservam estados veridicos; publicacao atomica/recuperavel da autoridade com HMAC, anti-rollback e exclusividade preservados, falhas de I/O controladas em fixtures e retomada. P2-02/11/12, P3-02.
I5 - Prova integrada (AC-23): 2 sessoes reais simultaneas, live/replay/transcript/completion/restart consistentes, isolamento e canais corretos; cobrir os 14 achados por RED/GREEN permanente, combinacoes representativas e limites adversariais por invariante. Cumulativa integral serial com exit direto 0, zero SKIP e estresse concorrente focado separado em janela sem testes externos; preservar logs RED, hashes e integridade. Usar apenas autorizacao UAC nova e pontual se indispensavel; nenhuma elevacao nesta ordem.

Rota: Executor persistente apos PRE_DISPATCH, diagnostico -> matriz/contraprovas -> correcao causal em lote -> validacao integral -> READY_FOR_FREEZE ou BLOCKED. Revisor independente deve verificar a matriz e os limites, consolidar achados comprovados com criterio contratual/causalidade; nao prometer ausencia absoluta de defeitos, nem aceitar hipotese como blocker ou suprimir falha real. Se a matriz revelar necessidade de mudanca de destino/arquitetura fora do contrato, retornar BLOCKED com decisao especifica ao Cerebro antes de expandir. Nenhum freeze ate ordem; sem push, PR, merge, deploy ou P5. P4-PR04 RUNNING, contrato/ordem das 42 PRs e gates existentes intactos.

## 2026-11-26 - Recuperacao f0a166b: PRE_DISPATCH e matriz causal I1-I5 (antes de editar)

- HEAD f0a166bf241a1951d2f388fdb976d268a250f51b, worktree limpo, reconciliador allowed:true/START_P4_PR04, parecer SHA256 E2335A293DEAB772575753D3CDBA3F8BFF7C60F52A9D3F17F867F7512986E360 confirmado. Oito achados anteriores GREEN no parecer; seis novos reproduzidos no HEAD via tres probes independentes, logs .morrow-test-tmp/p4-pr04-recovery-f0a166b/*-red.log, probe exit 0 indica execucao, nao controle GREEN. Preflight inicial bloqueou; repetido com zero workloads detectados. Nenhum codigo alterado ate este registro.
- I1 / P2-01,05,08 / P3-01: politica aplicada ao argv e ao output em fronteiras separadas, sem transportar literais explicitamente marcados na vida da sessao. Canonicalizar politica por sessao antes do start/observacao, usar mesma primitiva em todos os canais/resultado, nenhuma persistencia dos literais. Preservar saida segura e holdback; testar eco fragmentado, argv marcado, canais stdout/stderr/terminal, erros e reopen. Manager bruto continua API interna privilegiada comprovada pelo teste terminal-session que exige stdout original; Worker publica somente redigido.
- I2 / P2-03,04,06,07,11: mapa/reserva e enumeracao de nomes nao consultam autoridade externa antes de start. Reutilizar readAll autenticado do Event Log antes de efeito, reserva case-folded antes de await, cruzar transcript/ancoras quando faltam logs. Scan de log ausente com prepared e previous committed nao pode abortar/resetar como vazio. Manter manager direto historico fora da autoridade da observacao; impedir novo vinculo/publicacao. Testar perda de log, alias, contrato distinto, prepared sobre committed, reservas concorrentes e restart.
- I3 / P2-02,07,09,10 / P3-02: evento compartilhado mutavel no emissor, validacao parcial do payload e transicoes duplicadas live/reopen. Detach/freeze no produtor; criterio unico de schema por tipo (metadados, campos exatos, tipos, backend/canal, redaction, resultado e transicoes), aplicado antes de transcript/append/publicacao e na leitura; estado derivado de evento duravel. Falha inicial canonica sem START inventado. Testar observer antes/depois, payload autenticado invalido de cada tipo, falha de launch e coerencia completion/replay/reopen.
- I4 / P2-02,11,12 / P3-02: atualizacao truncate de binding e janela de durabilidade; publicar binding completo atomicamente sob lock existente, tratar primeiro PREPARE autenticado ainda nao publicado como transicao recuperavel sem resetar historico iniciado, preservar HMAC/anti-rollback e recusar journal ausente com historia. Testar barreira, falha antes/depois de publicacao, retomada, perda de ancora, append falho e restart. Transcript publico apenas registros vinculados aos eventos efetivamente duraveis; preservar armazenamento e politica.
- I5 / AC-23: repetir 23 casos Worker, 24 governance e regressao herdada, acrescer contraprovas permanentes por invariante e combinacao de duas sessoes reais. Cumulativa serial com exit direto, estresse separado, monitor de host, zero SKIP. Autorizacao UAC anterior consumida; solicitar nova somente no gate de symlink. Nao se promete ausencia absoluta de defeitos; sem nova autoridade, storage, dependencia ou runtime, sem freeze/P5.

## 2026-11-26 - Recuperacao f0a166b: correcoes de fronteira aplicadas, provas RED permanentes

- Seis contraprovas permanentes executadas antes da correcao: worker-invariants-red 0/5, binding-invariants-red 0/1, exit direto 1 em ambas, zero SKIP. Reproducoes originais do Reviewer tambem preservadas. A prova de binding cobre leitura concorrente e I/O antes/depois da publicacao; a de schema exercita todos os oito tipos, nao apenas EXIT.
- I1: StreamRedactor deriva politica por vida com literais marcados no request detached; manager fornece politica escopada para observacao externa sem publicar os literais. Completion e canais usam a mesma politica; close interrompido protege holdback incompleto. Manager bruto continua privilegiado.
- I2: reserva em memoria antes do await e scan autenticado per-ID antes do start; transcript retido identifica IDs ausentes da enumeracao; observacao externa checa autoridade antes de admitir. Event Log nao pode tratar log ausente com PREPARE sobre committed como vazio.
- I3/I4: terminal manager publica evento detached/deep-frozen e resultado imutavel; worker usa validacao semantica unica raw/public/stored e mesmo redutor de estado live/reopen. Falha de launch aceita FAILED inicial sem fabricar START. Snapshot/completion verificam fatos EXIT duraveis; transcript publico filtra IDs vinculados a eventos efetivamente persistidos. Autoridade publica primeiro PREPARE autenticado completo antes da transicao atomica monotona do binding sob lock existente; primeiro PREPARE ainda nao publicado pode ser recuperado sem apagar historia iniciada, journal ausente apos historyStarted continua invalid. Preservados storage, autoridade, APIs e limites existentes.
- Diff-check e dependencias GREEN. Preflight da primeira validacao apos correcao detectou MKT e Comercial ativos (09:07 BRT); nao iniciou testes nem interferiu nos processos. Proximo: focused GREEN, contraprovas combinadas/adversariais, cumulativa e estresse em janela sem concorrencia externa. Nenhuma elevacao nova, freeze, commit ou P5. Nenhuma correcao declarada provada ate testes GREEN.

## 2026-11-26 - Recuperacao f0a166b: contraprovas causais

- worker-green-01: 27/28, exit direto 1. Cinco novos testes Worker e oito achados anteriores cobertos; fixture ConPTY reforcada falhou na verificacao literal do eco dividido por escritas, nao em evidencia de vazamento. Mantida exigencia de eco real e resultado canonico; fixture nativa usa uma escrita (fragmentacao preservada nas contraprovas pipes). Acrescida tentativa de mutar EXIT antes do observador Worker, sem relaxar asserts. Acrescido teste Event Log de perda do log com PREPARE sobre committed; nao executado ainda.
- causal-green-02: 69/69 PASS, 0 FAIL/CANCELLED/SKIP/TODO, exit direto Node 0, 43105.8221 ms. Worker 28/28, governance 25/25, terminal-session 16/16. Todos os seis novos achados GREEN e oito anteriores GREEN nesta prova; dupla ConPTY real com eco explicitamente marcado e observador hostil GREEN. Sobreposicao externa detectada por amostragem na primeira rodada (Marketing verify-final PID 29820) e na segunda (Comercial PID 27312/12332), embora ambas tenham preflight zero. Resultados causais preservados, nao satisfazem gate de isolamento I5. Nenhum processo externo interrompido. Proximo: cumulativa serial e estresse isolados, direct exit e logs; sem elevacao, freeze, commit ou P5.

## 2026-11-26 - Recuperacao f0a166b: cumulativa integral

- serial-01/02 abortados antes de iniciar Node por workloads externos detectados; logs preservados. serial-03 executou todos os 283 testes com --test-concurrency=1, 281 PASS, 2 FAIL, 0 CANCELLED/SKIP/TODO, 132436.4708 ms, exit direto Node 1, stderr vazio. Monitor: 65 amostras, zero sobreposicoes detectadas, zero erros. Ambas falhas EPERM syscall symlink na criacao da fixture nativa: D-015 snapshot replacement (p4-pr03-replay.test.ts:135) e symbolic file snapshot (stream-transcript.test.ts:1499). Sem falha funcional observada; nao declarar os dois testes GREEN sem reexecucao autorizada. Nova contraprova perda do log com PREPARE sobre committed GREEN. Todos os 14 achados da P4-PR04 cobertos e GREEN na cumulativa; I5 ainda BLOCKED pelo gate integral 283/283. Nenhum skip, alteracao de permissao, UAC ou enfraquecimento. Estresse separado iniciado somente apos termino da cumulativa, resultados pendentes.

## 2026-11-26 - Recuperacao f0a166b: estresse separado

- stress-01: 69/70 PASS, 1 FAIL, 0 CANCELLED/SKIP/TODO, exit direto Node 1, 35117.9348 ms; 22 amostras, zero workloads externos detectados, zero erros de monitor. A unica falha foi native ConPTY multiplex/cleanup: T-R1-input-a terminou timed_out=true em vez de completed. Cumulativa serial passou essa mesma prova. Nenhum timeout, assert, limite ou runtime alterado para fazer a prova passar. Inspecao: probe usa limite de 10000 ms de sessao de entrada, envia token apos marker READY e aguarda completion; o erro prova timeout mas nao discrimina atraso, perda de entrada ou encerramento do filho. Nao atribuir causa ao freeze de eventos nem ao ambiente sem nova evidencia. Repetir estresse exatamente igual como contraprova, preservar ambos resultados; gate I5 permanece BLOCKED ate diagnostico causal e nova prova integral.

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


## 2026-11-26 - I5: gates de execucao GREEN; diagnostico historico BLOCKED

Cadastro exclusivo Morrow concluido pelo instalador oficial e validado: 179 arquivos rastreados preservados na instalacao, demais frentes/regras globais intactas, resolucao/enter PASS, sessoes Guardian encerradas apos cada mutacao. Falhas preliminares de inventario/validacao do instalador registradas e resolvidas sem repetir instalacao nem alterar regras. No fechamento, 175 arquivos rastreados fora dos quatro documentos de continuidade conferem byte a byte com o inicio; nove hashes tecnicos I1-I4 intactos, index vazio, dependencias sem delta, diff-check GREEN.

| Prova | Resultado | Exit direto | Monitor / recursos |
|---|---|---|---|
| Probe ConPTY instrumentado isolado | 12 sessoes, 6completed/3timeout intencionais/3stopped, sem orfaos | 0 | 13 amostras; RAMmin2800MiB; CPUmax29% |
| Estresse instrumentado, asserts/prazos originais | 70/70, zero fail/cancelled/skip/todo | 0 | 19 amostras; RAMmin2342MiB; CPUmedia37.47%, max90% |
| Regressao integral ORIGINAL, serial elevada | 283/283, zero fail/cancelled/skip/todo | 0 | 45 amostras; RAMmin2861MiB; CPUmedia15.69%, max100% |
| Estresse ORIGINAL separado, nao elevado | 70/70, zero fail/cancelled/skip/todo | 0 | 19 amostras; RAMmin2612MiB; CPUmedia23.74%, max88% |

Zero workloads externos detectados e zero erros de monitor nas execucoes, por amostragem antes/durante/depois; nao representa garantia de capturar processos breves entre amostras. Primeiro preflight stress-trace-01 abortou antes do Node por CPU67%; preservado. As tres execucoes de testes acima ocorreram separadamente, sem provas concorrentes externas observadas. Dois symlinks anteriormente EPERM passaram na regressao elevada. Processos elevados/testes proprios confirmados ausentes, PID elevado4972 encerrado, DC/Guardian nao elevados; nenhuma permissao/politica permanente alterada, nenhum processo alheio/emulador encerrado ou modificado.

Diagnostico: 12 inputs observados entre probe isolado e estresse instrumentado concluiram exit0. Isolado START->READY47-68ms, write->ACK15.9-16.3ms, ACK->EXIT1057-1069ms, START->completion1160-1174ms. Estresse START->READY59-184ms, write->ACK15.6-17.0ms, ACK->EXIT1067-1086ms, START->completion1157-1290ms: margem minima aproximada8.7s para limite10s. Preparacao de colisao3.05-4.27ms terminou antes de START. O intervalo final de ~1s e compativel com drenagem1000ms do node-pty instalado. Nao houve entrada perdida ou cleanup anormal observado; isso NAO demonstra a causa do timeout T-R1-input-a de stress-01 historico, que nao registrou timeline/recursos. RAM/CPU, listener e cleanup permanecem hipoteses nao comprovadas para aquele episodio. Nenhum timeout/assert relaxado e nenhum codigo rastreado alterado nesta etapa; instrumentacao confinada a copias em evidencias.

Disposicao: BLOCKED exclusivamente pelo diagnostico causal historico inconclusivo. Gates executaveis I5 e I1-I4 GREEN nas provas atuais; nao se converte isso silenciosamente em aceitacao da intermitencia anteriormente bloqueante. Proximo ponto ao Cerebro: avaliar a evidencia atual e definir o tratamento desta pendencia; se exigir nova prova causal, usar os probes instrumentados existentes para capturar uma ocorrencia, sem alteracoes especulativas nem repeticao indefinida. Nao ha nova falha funcional reproduzida nestas execucoes que autorize reabrir I1-I4. Autorizacao temporaria usada somente na regressao integral e processo encerrado.

Evidencias: .morrow-test-tmp/p4-pr04-i5-closure/FINAL_VERIFICATION.json, process-termination-verification.json, trace-analysis.json, traces/, logs originais, snapshots CPU/RAM/processos, guardian-jobs/ e scripts exatos. SHA256SUMS.txt: FA25AF3A960AAD7813320807352C7D6805FF6245ECA6CCF03D51039D0B66F035. Full serial log: 9B984CD4CD7D4DAA4800BD1668B4903B3F1642021F9A5211F852A679C7D11B23; stress original: C342D1E610EF584145B0B5E1572C76B7FF35A89602815C7070949812BF253E28; stress instrumentado: 15E05085A830B0ACC421F2761B710F41FB4391DB5338369F548C5BF8C17BB8C2. HEAD f0a166bf241a1951d2f388fdb976d268a250f51b; worktree recuperado preservado e propositalmente dirty, candidate6372857 permanece SECURITY_REVIEW_BLOCKED. Sem stage, commit, freeze, push, PR, merge, deploy ou P5.

## 2026-11-26 - Cerebro: freeze autorizado apos provas I5

Conferencia independente via DC: serial original 283/283, stress original 70/70, stress instrumentado 70/70, probe 12 sessoes; todos direct.exit e runner.exit 0, zero FAIL/SKIP nos testes; hashes dos quatro logs e manifesto FA25AF3A960AAD7813320807352C7D6805FF6245ECA6CCF03D51039D0B66F035 conferidos; nove arquivos tecnicos conferem com checkpoint f0a166b, diff-check GREEN, dependencias intactas, PID elevado 4972 ausente. Coordenacao morrow registrada e validada. Amostras sem interferencia externa detectada; nao garantem exclusividade absoluta.

Decisao: autorizar apenas freeze local do worktree recuperado para revisao independente. Causa historica do timeout T-R1-input-a permanece inconclusiva, sem reproducoes nas provas atuais, com margem medida de cerca de 8.7s; preservar evidencias RED/GREEN. A exigencia operacional anterior de localizar a causa exata antes do freeze fica substituida por avaliacao independente das provas atuais e do risco residual, sem alterar contrato, controles, gates, limites ou assertions. Nenhuma regressao comprovada pode ser aceita como debito; REGRESSION_VETO permanece nao iniciado, Security Review deve verificar suficiência da cobertura e se ha bloqueio material ou prova faltante. Nao declarar causa ambiental nem eliminacao definitiva, nao alterar codigo especulativamente. Freeze nao equivale a aprovacao, merge ou PROVEN. Executor: preservar artefatos e codigo, commit tecnico/documental separado, atualizar continuidade e reconciliar Git limpo; retornar FROZEN_AWAITING_SECURITY_REVIEW com SHA exato. Usar Guardian e coordenacao, sem nova elevacao (autorizacao consumida), push, PR, merge, deploy ou P5.


## 2026-11-26 - P4-PR04 FROZEN_AWAITING_SECURITY_REVIEW

### Identidade e preservacao

- Candidate/Execution Root tecnico: `2e0a54cef6ab4ae2cae8e08c13c16fb273b48479`; parent `f0a166bf241a1951d2f388fdb976d268a250f51b`; base `78e1bfdc7d32f2e150d03aaee80b62514c446d4f`; branch `mvo/p4-pr04-multi-session-stream`.
- Candidato anterior `6372857cb645f994d31125bdb4ed8baef97591c8`: SUPERSEDED/INVALIDATED. Seu Security Review BLOCKED e os achados anteriores permanecem historicos; nenhuma aprovacao transferida.
- Commit tecnico: 9 files changed, 593 insertions(+), 138 deletions(-). Delta tecnico integral contra base: 14 files changed, 2833 insertions(+), 65 deletions(-). Caminhos e patches gerados por git --output, preservando bytes, em `.morrow-test-tmp/p4-pr04-freeze-f0a166b-01`.
- Os nove arquivos do checkpoint validado mantiveram SHA256 bruto identico; os blobs esperados antes do stage conferem com index e commit. 175 arquivos rastreados fora da continuidade conferiram com o inicio do I5; nenhuma mudanca funcional, de dependencia, teste, assertion ou timeout no freeze.
- Manifestos anteriores reconferidos integralmente: recovery-f0a166b/SHA256SUMS.txt, 66 arquivos, A4FC8C57D73EC0970793A84354FB99273E3CA08BC5C168880DC57D80D4A5B161; p4-pr04-i5-closure/SHA256SUMS.txt, 131 arquivos, FA25AF3A960AAD7813320807352C7D6805FF6245ECA6CCF03D51039D0B66F035. Logs RED/GREEN e diagnósticos originais intactos.
- Novo manifesto tecnico: `.morrow-test-tmp/p4-pr04-freeze-f0a166b-01/TECHNICAL-SHA256SUMS.txt`, SHA256 09B8EC9EB76C46C2DF753300D1C544C70D671A7612785F2A9960E1E7A756AF18. Contem preflight, identidade do commit, hashes/blobs, patches e snapshot documental anterior ao freeze.

### Provas preservadas e risco residual

| Prova | Resultado | Exit direto | Observacoes |
|---|---|---|---|
| Regressao integral original, serial elevada | 283/283 | 0 | Zero FAIL/CANCELLED/SKIP/TODO; ambos symlinks nativos PASS |
| Estresse original separado, nao elevado | 70/70 | 0 | Zero FAIL/CANCELLED/SKIP/TODO |
| Estresse instrumentado, asserts e limites preservados | 70/70 | 0 | Copias de diagnostico fora do codigo rastreado |
| Probe instrumentado isolado | 12 sessoes | 0 | 6 conclusoes, 3 timeouts intencionais, 3 cancelamentos; sem orfaos |

RAM/CPU/processos monitorados nas provas, sem workloads externos detectados por amostragem; sem garantia de capturar processos breves entre amostras. Processo elevado do I5 encerrado, sem alteracoes permanentes de permissao; nenhuma nova elevacao ou teste durante o freeze. Emulador Atria e demais projetos preservados.

Risco residual: episodio historico de T-R1-input-a timed_out no stress-01 da recuperacao. A causa permanece inconclusiva; nao houve reproducao nas provas atuais e os inputs instrumentados terminaram em aproximadamente 1,16-1,29s contra limite de 10s. Nao afirmar causa ambiental, inocuidade ou eliminacao definitiva. A ordem expressa do operador/Cerebro autoriza freeze com avaliacao independente das provas e deste risco, substituindo somente a exigencia operacional anterior de causa exata antes do freeze. Contrato, controles, gates e limites permanecem intactos. Nenhuma regressao comprovada foi aceita como debito.

### Handoff e verificacao final

Revisor independente, sessao nova, deve usar o candidato exato acima contra a base e o candidato anterior; conferir os 14 achados/contraprovas, I1-I5, suficiência da cobertura e evidencia de intermitencia. O revisor decide se ha bloqueio material ou prova faltante. Estado FROZEN_FOR_SECURITY_REVIEW / SECURITY_REVIEW_PENDING; P4-PR04 RUNNING e START_P4_PR04 mantidos como estado/acao amplos. Freeze nao significa Security Review GREEN, REGRESSION_VETO PASS, merge ou PROVEN.

O commit documental posterior altera somente LIVE_STATUS/EVIDENCE/MAP/PRS. Sua identidade e a verificacao de Git limpo/reconciliador sao gravadas em `.morrow-test-tmp/p4-pr04-freeze-f0a166b-01/FINAL_VERIFICATION.json` apos o commit, evitando autorreferencia de SHA. Reconciliador bruto em reconciler.json e exit code em reconciler.exit; inventario final em FINAL-SHA256SUMS.txt. Guardian registra o resultado observado. Sem push, PR, merge, deploy ou P5.

## 2026-11-26 - P4-PR04: diagnostico dos bloqueios I5 do Revisor PRO

- SECURITY_REVIEW_BLOCKED permanece como parecer vigente; candidato tecnico congelado `2e0a54cef6ab4ae2cae8e08c13c16fb273b48479`. I1-I4 preservados. Os 14 achados anteriores passaram no parecer PRO. Dois REDs historicos por verificacao de encerramento por PID e unicidade global de descendentes; PIDs exatos dos REDs nao registrados, causa retrospectiva indeterminada.
- DC/Guardian, sem mudanca em codigo ou dependencias: isolated-03 2/2 PASS, exit direto 0, RAM min 1898 MiB, CPU max 38%; controlled-01 1/2, exit direto 1, RAM min 1986 MiB, CPU max 82%, 100 processos sinteticos curtos sequenciais em paralelo aos testes. Falha controlada de unicidade global de root, da mesma classe do RED de descendentes. Nenhum teste externo real detectado nas 3 amostras de recursos de cada rodada; emulador e worktree Atria preservados. Duas tentativas anteriores barradas por CPU 97% e 61%. Monitor amostral, sem causalidade comprovada de RAM/CPU ou worktree.
- PID 5716 repetido em duas sessoes concluidas, EXIT 16:52:21.645Z e novo START 16:52:26.691Z, gap 5046 ms, sem sobreposicao registrada. Nascimento desse PID especifico nao capturado. PID 14860 teve dois nascimentos Windows distintos (16:51:34.4103374Z e 16:51:38.9295586Z), host e descendente, ambos desapareceram. Oito PIDs mudaram pai/nome no monitor historico PRO, sem vinculo aos REDs exatos.
- Prova direta de falso positivo de liveness: PID 20772, sessao T-R3-cancel, round encerrado 16:52:32.026Z, novo filho sintetico nasceu 16:53:52.6278527Z. Mesmo PID, nova identidade; verificacao por numero retornou vivo; filho saiu 0. Prova auxiliar Node exit 0, mas preflight PowerShell teve erro de quoting (stderr preservado): nao validar gate de recursos dessa prova. Nenhum sobrevivente original ou novo defeito funcional do runtime comprovado. Os dois mecanismos de erro metodologico estao demonstrados; REDs historicos exatos ainda nao explicados individualmente.
- Menor solucao proposta, NAO aplicada: corrigir apenas harness/testes/probe para registrar PID + CreationTime ou identidade do handle no nascimento, exigir unicidade entre vidas simultaneas e verificar morte da identidade original. Se identidade desconhecida, nao declarar GREEN. Manter todos os checks de root/host/descendentes, isolamento, cancelamento e timeouts. Reexecutar duas provas, stress e regressao apos autorizacao. Sem escrita tecnica, elevacao, commit, novo freeze, push, merge ou P5.
- Evidencias brutas: `.morrow-test-tmp/p4-pr04-pid-diagnosis-2e0a54c/` (isolated-03, controlled-01, liveness-proof.json); Guardian jobs 20261126-135042-207fc1f0, 20261126-135059-df844a29, 20261126-135124-5c4e6bda, 20261126-135201-c538e094, 20261126-135343-f5ed10ed. Consolidacao automatica completa nao concluida por erro de script e bloqueio da ferramenta; nao alegar manifesto novo conferido. HEAD documental preservado 9c911ac19ed26d79c88866dcd958e9ade54e4a11. Proxima decisao: Cerebro/operador autorizar correcao exclusiva do harness.

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

## 2026-11-26 - P4-PR04 REVIEW_READY_FOR_AUDITOR e handoff ao Auditor

Execution root/candidato tecnico 2ed65f83ad2f56e797712475dab0a5fe3e3e7c99; base 78e1bfdc7d32f2e150d03aaee80b62514c446d4f; opening control root 6f593eab2b843220572d4849c6f1ff1ab8e3a6ee; control root revisado 358e1013d3a0bf1d0a95453fcb12102b4e89ab53. Independent Reviewer emitiu REVIEW_READY_FOR_AUDITOR. Parecer confirmado via DC em .morrow-test-tmp/p4-pr04-independent-reviewer-gate-2ed65f8/REVIEW_READY_FOR_AUDITOR.md, SHA256 7FBF602240E8604ED432C09B22AAD6CA65D63D0BDC9E0452AAA212FAC2A25FC9, e FINAL_VERIFICATION.json. Contrato, genealogia, escopo, 16 blobs tecnicos, 197 entradas de manifestos, cobertura, 14 achados e I1-I5 GREEN; Security Review GREEN confirmado. Focus 14/14, stress Executor 73/73, regressao serial elevada congelada 286/286, stress Security Reviewer independente 73/73, todos exit 0 e zero SKIP. Provas reaproveitadas, sem novas execucoes nem elevacao. Sessoes read-only distintas do Executor; mesmo contexto de chat do Security Review, sem alegar nova identidade de agente/modelo. Jobs Guardian 20261126-143930-6d1bfacd e 20261126-144038-f1babc1f. Risco residual ConPTY historico inconclusivo permanece nao bloqueante neste gate. Nenhum bloqueio contratual identificado.

Cerebro versiona o parecer exclusivamente em LIVE_STATUS, EVIDENCE, MAP e PRS, formando novo control root documental descendente de 358e101, sem mudar execution root. P4-PR04 RUNNING; candidato congelado para auditoria. Proximo ator unico: Auditor independente, nova sessao read-only, validar genealogia, autoridade, separacao de roots, gates frescos, independencia real, cobertura e evidencias, escopo e ausencia de drift; reaproveitar provas validas, sem repeticao indiscriminada. Retornar AUDIT_GREEN - P4_PR04_READY_FOR_INTEGRATOR ou AUDIT_BLOCKED fundamentado. Nenhum push, abertura de PR, merge, deploy ou P5 autorizado. REGRESSION_VETO pos-merge e auditoria final pendentes.
