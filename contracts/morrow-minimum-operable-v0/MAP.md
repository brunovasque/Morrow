# Mapa de execução — MORROW-MVO-001

O contrato declara o destino. Este mapa declara a rota inicial. A rota pode voltar, repetir ou mudar com evidência registrada; o destino não muda sem adendo aprovado.

## Sequência macro

```text
P0 Contrato e controle de execução
       ↓
P1 Fundação processual (baseline já provado)
       ↓
P2 Local Worker
       ↓
P3 Terminal ConPTY real
       ↓
P4 Observabilidade durável
       ↓
P5 Interface + Cérebro + reunião
       ↓
P6 Notificações + Nexus opcional
       ↓
P7 Contrato ponta a ponta
       ↓
P8 Operação, Acceptance e fechamento MVO
```

P1 já existe como baseline, mas permanece no mapa para preservar proveniência e regressão. Após P0 fechar preflight, a rota executável normal começa em P2.

## Fases

| fase | objetivo | por que existe | PRs | papéis principais | entradas | saídas | pré-requisitos | superfície de regressão | evidência exigida | gate de conclusão |
|---|---|---|---|---|---|---|---|---|---|---|
| `P0` | Congelar destino, rastreabilidade, PRs e retomada determinística | Impedir execução “de cabeça” e desvio entre abas | `P0-PR01..03` | Contract Engineer, Architect, Test Designer, Security Reviewer, Acceptance, Orchestrator, Owner | documentação canônica + baseline `ff0359c` | pacote aprovado + validador + `READY_FOR_EXECUTION` | owner review e passes independentes | contratos, gates, branch e status | validação estrutural, perguntas resolvidas, decisão do dono | CONTRACT_PREFLIGHT |
| `P1` | Preservar kernel/process/runtime baseline já aceito | Evitar reconstruir ou regredir fundação existente | `P1-PR01..04` | Executor, Reviewer, Auditor | commits históricos + testes | baseline reprodutível de 25 testes | já provado | event log, state, predispatch, workspace, quota adapter, terminal processual | `npm test`, commits e docs | `PROVEN_BASELINE` |
| `P2` | Criar Local Worker governado, guards/registries mínimos e recovery | PowerShell/CLIs/workspaces locais precisam de autoridade mecânica própria | `P2-PR01..06` | Architect, Executor, Security Reviewer, Reviewer | contrato + baseline P1 | protocolo, serviço, registries, guards, dispatch, heartbeat, recovery | P0 e P1 | processo, filesystem, auth, target, skill, capability, secrets, routing, quota, budget, locks, checkpoint | testes de serviço/recusa/restart/offline e Security Review | Worker inicia, anuncia capabilities e executa somente dispatch completamente autorizado |
| `P3` | Entregar terminal Windows PTY/ConPTY verdadeiro | Pipes não cumprem a experiência final prometida | `P3-PR01..04` | Architect, Experimenter, Executor, Security Reviewer, Acceptance | Worker P2 + terminal processual P1 | backend ConPTY, multiplexing e Codex CLI integrado | P2 | terminal, sinais, UTF-8, input, resize, cleanup, quota | prova interativa real + testes de isolamento/soak | AC-06, AC-08, AC-14 e AC-20 aplicáveis |
| `P4` | Tornar atividade observável, segura e reidratável | Terminal vivo sem evento/replay não sustenta confiança nem retomada | `P4-PR01..04` | Architect, Executor, Test Designer, Security Reviewer, Auditor | P2/P3 + Event Log | schema, projector, redaction, transcript, replay, liveness/API stream | P3 | eventos, segredos, storage, restart, ordenação | testes adversariais, replay e duas sessões; para P4-PR02, revisão local independente somente-leitura conforme `A-001` | AC-03, AC-07, AC-16, AC-20, AC-21 |
| `P5` | Entregar interface do operador, Cérebro e reunião | O produto precisa ser operado sem depender do terminal/manual técnico | `P5-PR01..06` | Discovery, Architect, Executor, Reviewer, Security Reviewer, Acceptance | APIs P2-P4 + governança | dashboard, panes, chat, meeting room e controles | P4 | UX, identidade, autoridade, comandos, terminal rendering, meeting | Acceptance visual/funcional, autorização e acessibilidade básica | AC-05, AC-07, AC-10, AC-11, AC-15, AC-28, AC-29 |
| `P6` | Avisar e receber decisão fora do PC; integrar Nexus opcionalmente | Autonomia para quando o operador não está diante da máquina | `P6-PR01..05` | Architect, Security Reviewer, Executor, Reviewer, Acceptance | eventos/decisões P4-P5 + Worker | gateway, canal externo, resposta autenticada, Nexus adapter, offline semantics | P5 | rede, identidade, replay, duplicação, custo/credenciais | roundtrip externo, delivery receipt, testes offline/security | AC-12, AC-13, AC-16, AC-20 |
| `P7` | Executar um contrato real completo, incluindo regressão, dívida e aprendizado | Partes isoladas não provam funcionamento do Morrow | `P7-PR01..07` | Discovery, Contract Engineer, Orchestrator, Executor, Diagnostician, Reviewer, Auditor, Acceptance, Supervisor | P0-P6 | objetivo, question round, contrato aprovado, dispatch adaptativo, regressão/inheritance, integração Git, aprendizado, cenário E2E e suite adversarial | P6 | todos os critérios e invariantes | prova objetivo→contrato aprovado→PR com reunião/decisão/restart/debt/retrospectiva | AC-02..AC-23 e AC-25..AC-27 aplicáveis |
| `P8` | Tornar instalável, verificável e fechar o MVO | Harness verde não equivale a produto operável | `P8-PR01..03` | Integrator, Security Reviewer, Auditor, Acceptance, Supervisor, Owner | candidato P7 | bootstrap, runbooks, Acceptance Windows, auditoria, release/snapshot | P7 | instalação, atualização, recuperação, documentação, métricas | execução limpa fora do dev harness + CONTRACT_CLOSE | AC-01, AC-23..AC-29 e aprovação do dono |

## Dependências e paralelismo

- Uma PR só fica `READY` quando todas as dependências listadas em `PRS.md` estão `PROVEN`.
- Paralelismo só é permitido quando `PRS.md` o declara e os lock scopes não se sobrepõem.
- P3 pode abrir spike técnico somente depois do protocolo Worker P2-PR01; implementação ConPTY depende do host P2-PR02.
- P5 não fabrica dados: UI depende das APIs/eventos reais de P4.
- P6 não usa Nexus como atalho para evitar Notification Gateway.
- P7 não inicia sobre mock como prova final; fixtures podem preparar o cenário, mas Acceptance usa componentes reais.
- P8 não fecha com feature central marcada “TODO”, teste apenas simulado ou dívida que invalide critério do contrato.

## Rotas de retorno autorizadas

| achado | retorno mínimo |
|---|---|
| ConPTY não preserva semântica necessária | P3-PR01/02 → novo spike/ADR; processo-pipes permanece fallback rotulado, não aceite final |
| Stream vaza segredo | P4-PR02 → Security Review aplicável (`A-001` somente nesta unidade) → reexecução de toda prova afetada |
| UI não corresponde a eventos reais | P5 → P4 projector/API → P5 Acceptance novamente |
| Notificação duplica/perde decisão | P6-PR01/03 → idempotência/auth → repetir cenário P7 |
| Restart repete efeito | P2-PR06/P4-PR03 → checkpoint/replay → revalidar P7 |
| Reviewer/Auditor perde independência | P5/P7 → contexto/dispatch → repetir review/audit |
| Descoberta muda destino | parar; registrar `ADDENDA.md`; exigir owner approval |
| Descoberta é lateral | `DEBTS.md`; não implementar no contrato atual |

## Exceção de rota aprovada — A-001

Somente para P4-PR02, a indisponibilidade do Security Review externo é tratada pela seguinte rota substituta:

```text
base 3657a070e5dc6b1e7b78fa1804761440c55efffc
  → candidate inicial 79382d421a9a6e9df2956007fb701d32d00c5952
  → sessão local de Security Reviewer distinta do Executor
  → checkout somente-leitura e SHAs verificados antes da análise
  → relatório de transcript/redaction com cobertura, ferramenta, testes,
    achados, limites e veredito
  → P2 de DoS algorítmica encontrado: BLOCKED e retorno a P4-PR02
  → correção estrutural a44daee73ac6bb9b91523a947a6e0154397efcee
  → microfix posterior de segmentação linear 15e3ac733fc295d4cff3762de957f348a6e02c01; a44daee superseded/invalidated
  → nova sessão local independente, read-only, base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e candidate `15e3ac733fc295d4cff3762de957f348a6e02c01` novamente fixados
  → A-001 do candidate 15e3ac733fc295d4cff3762de957f348a6e02c01 executado: P2 de bypass por reconstrução VT CSI b / REP encontrado; BLOCKED
  → Executor reproduziu o RED e corrigiu o fail-closed para REP; novo candidate `ba350658a39f270cbc9ec559c193997a1a0db047`; 15e3ac7 superseded/invalidated
  → focused 25/25, regressão completa 197/197 e `git diff --check` GREEN no novo candidate, sem A-001 válido ainda
  → A-001 do candidate `ba350658a39f270cbc9ec559c193997a1a0db047` ficou BLOCKED por P2 de bypass HPA + DCH; o diagnóstico confirmou classificação CSI estruturalmente insegura
  → Executor implementou allowlist CSI com SGR numérico comprovadamente inerte e fail-closed para demais CSI; separou string controls completos do classificador CSI e corrigiu antes do commit o efeito colateral 7-bit/C1 do primeiro diff; `ba350658` superseded/invalidated
  → novo candidate real `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`, parent `c8bb6afda8640bc11b9b82d36d931374fd725153`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`
  → focused 31/31, controle ConPTY GREEN, regressão completa 203/203 e `git diff --check` GREEN; D-013 permanece aberto e não foi corrigido nem ocultado; sem A-001 válido ainda
  → nova sessão local independente, read-only, deve revisar exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`; merge e regressão pós-merge continuam proibidos/pendentes
  → contraprovas adicionais encontraram superfícies ainda não cobertas; `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf` foi superseded/invalidated antes de novo A-001; não houve novo A-001 sobre `dc0bbaf`
  → REDs reproduzidos: opção CLI sensível; assignment JSON com whitespace multiline antes do separador; custo superlinear de string-control incompleto fragmentado; terminador C1 incorreto em OSC com over-redaction
  → causas: boundary genérico sem chave sensível após opção CLI; whitespace sem CR/LF antes do separador; `release()` reprocessando o `pending` crescente; `terminalOscEnd()` sem reconhecer C1-ST
  → novo candidate `95e808294395449b46438b799c0b7d480cece52d`, parent `84f095d87b6f3852d736f8cb11bbfa2d56efd2d6`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`
  → correção: reconhecimento estrutural de opções CLI sensíveis, whitespace estrutural multiline, scanner incremental bounded de terminal/string-control entre chunks e reconhecimento C1-ST em OSC; cercas CSI/VT estruturais preservadas
  → focused 35/35, primeira regressão 206/207 com única falha histórica D-013, soak posterior GREEN com 12 sessões/PIDs distintos/`noOrphans: true`/fixture removida, reexecução 207/207 e custo reduzido de segundos a poucos milissegundos no envelope 4k/8k/12k/16k; D-013 permanece aberto; sem alteração ConPTY/P3, push, merge ou deploy
  → novo candidate ainda sem A-001 válido; nova sessão local independente, read-only, deve revisar exatamente `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d`; merge e regressão pós-merge continuam proibidos/pendentes
  → A-001 do candidate `95e808294395449b46438b799c0b7d480cece52d` executado por Security Reviewer independente, nova sessão Luna xhigh: BLOCKED por P2 de C1 stateful com reconstrução visual de chave sensível e P2 de custo superlinear sob fragmentação; 95e808 superseded/invalidated e não é prova de integração
  → focused 35/35, primeira npm test 207/207, soak falhou somente em D-013, segunda npm test 206/207 com única falha D-013, transcript/redaction verde, diff check GREEN e worktree limpa
  → Executor reproduziu os dois P2; classificação C0/C1 fechada fail-closed, scans posteriores amortizados/batched, newline força reavaliação, finish() classifica o final, pending bounded e nenhuma liberação ignora o redactor
  → novo candidate atual `189c1ced569489508ceb7d052f5e2b521cf085dd`, parent `b1a3bdedf2d6131702661403bf31251761e8602a6`, mensagem `fix(p4-pr02): harden terminal controls and amortize stream scans`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`
  → focused 39/39, npm test 211/211, D-013 ausente nessa execução, git diff --check GREEN; medições externas pré-congelamento de texto comum 4.9/3.5/6.7/9.1/10.6 ms e assignment seguro 1.4/1.6/3.9/6.2/7.5 ms em 2k/4k/8k/12k/16k
  → 189c1ce ainda sem A-001 válido; P4-PR02 RUNNING / BLOCKED ON A-001; merge proibido, P4-PR03 não autorizada, D-013 aberto, sem alteração ConPTY/P3, push, merge ou deploy; próximo ator é Security Reviewer independente read-only em nova sessão Luna xhigh, no delta `3657a070e5dc6b1e7b78fa1804761440c55efffc..189c1ced569489508ceb7d052f5e2b521cf085dd`
  → A-001 completo de `189c1ced569489508ceb7d052f5e2b521cf085dd` executado por Security Reviewer independente Luna xhigh: BLOCKED por P2 de DoS algorítmico por newline fragmentado; focused 39/39, primeira npm test 210/211 com única falha D-013, soak somente D-013, segunda npm test 211/211, diff-check GREEN, worktree limpa; 189c1ce superseded/invalidated e não é prova de integração
  → Executor reproduziu RED, removeu a exceção de newline que furava batching; newline permanece pendente até janela amortizada ou finish(); sem threshold artificial ou parser novo; CRLF, multiline, C0/C1, CSI/VT, string-controls e demais cercas preservados
  → novo candidate atual `76a41db64343131dfc20b699bedfae491859f88b`, parent `479f44d8ecfe9668ac64ff8a9d547f82caf81f7d`, mensagem `fix(p4-pr02): amortize newline stream scans`, somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`
  → focused 42/42, npm test 214/214, git diff --check GREEN, D-013 ausente na execução do Executor; conferência externa pré-commit LF 2,34/3,46/7,54/8,17/9,06 ms e CRLF 1,52/1,86/3,99/7,91/9,17 ms em 2k/4k/8k/12k/16k; chunk único e 1-byte equivalentes, contraprova sensível sem canário, regressão 214/214 após controle ConPTY
  → 76a41db ainda sem A-001 válido; P4-PR02 RUNNING / BLOCKED ON A-001; merge proibido, P4-PR03 não autorizada, D-013 aberto, sem alteração ConPTY/P3, push, merge ou deploy; próximo ator Security Reviewer independente read-only em nova sessão Luna xhigh, no delta `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`
  → A-001 completo do candidate `76a41db64343131dfc20b699bedfae491859f88b` passou como `GREEN_LOCAL_A-001`: focused 42/42, npm test 214/214, diff-check GREEN, D-013 ausente, probe ConPTY desnecessário, sem canário em live/inspect/disco/reopen, sem findings P1/P2/P3/informational; integração e regressão pós-merge ainda requeridas; não é `PROVEN`, não autoriza merge, não equivale ao Security Review externo indisponível e não cria precedente
  → resolução canônica específica da P4-PR02: `START_P4_PR02` é coarse; `b6ed5ebc6411dad07ef9193554db13e88790ccee` é o anchor pré-fechamento; o HEAD publicável é a ponta local que satisfaz as condições mecânicas de ancestry, delta somente documental autorizado, ausência de código, worktree/diff e divergência remota, capturada/registrada pelo Integrator imediatamente antes do push e comprovada no remoto; PR #18 e merge commit sem squash/rebase; primeiro Auditor read-only emite `MERGE_READY`/`BLOCKED`; após merge, descobrir o HEAD real de `phase-2/runtime-v0`, rodar regressão completa e reconciliador; Auditor final emite `P4_PR02_PROVEN_READY`/`BLOCKED`; somente então Scribe marca `PROVEN`; Acceptance permanece fora do gate desta PR e P4-PR03 fica proibida até o fechamento mecânico
```

O relatório deve declarar expressamente que essa prova local não equivale ao serviço externo indisponível e não mede superfícies fora de transcript/redaction. Reviews anteriores, a narrativa do Executor e os testes já registrados são entrada reproduzível, não substitutos da nova revisão independente.

## Cobertura dos entregáveis

| entregável do contrato | fase(s) |
|---|---|
| pacote/retomada/validador | P0 |
| Local Worker | P2 |
| ConPTY/multiplexer | P3 |
| observabilidade/redaction/replay | P4 |
| Cérebro/interface/chat/reunião/controles | P5 |
| notificações/Nexus/offline | P6 |
| contrato→agentes→PR | P7 |
| instalação/Acceptance/release | P8 |

## Regra para escolher o próximo passo

1. Se `CONTRACT.md`/adendo tiver decisão bloqueante, o próximo passo é resolver essa decisão.
2. Se Git/Event Log divergir de `LIVE_STATUS.md`, o próximo passo é reconciliar estado, sem write de produto.
3. Caso contrário, escolha a primeira PR em `PRS.md` com status `READY`, dependências `PROVEN`, perguntas bloqueantes zero e target/base válidos.
4. Antes do dispatch, gere PRE_DISPATCH com objetivo exato daquela PR.
5. Falha de gate corrige/reabre a rota; nunca pula para a PR seguinte.
6. Ao provar a PR, atualize `EVIDENCE.md`, `PRS.md` e `LIVE_STATUS.md` antes de autorizar a próxima.

O campo `next_authorized_action` de `LIVE_STATUS.md` é a projeção humana dessa regra e nunca pode contrariá-la.

## Fechamento atual de P4-PR02

- P4-PR02 está `PROVEN`: PR de produto `#18`, merge `3738d7877cc1613e363adee8063322eefb595528`, parents `3657a070e5dc6b1e7b78fa1804761440c55efffc` e `46167607c6f0c55a7f48eec2464a7cbda327dc22`.
- `P4_PR02_PROVEN_READY` foi emitido após `MERGE_READY`, `npm ci` GREEN, focused `42/42`, `npm test` `214/214`, `git diff --check` GREEN, ausência de D-013, drift e paths inesperados; a árvore do merge é idêntica à do head integrado.
- O reconciliador na closure-record branch retornou exclusivamente `BLOCKED_STATE_DIVERGENCE` / `git_branch_mismatch`, decisão `EXPECTED_DETACHED_CONTEXT_DIVERGENCE` para o contexto detached/branch-aware quando aplicável. A divergência não é regressão do artefato integrado.
- A unidade ativa é P4-PR03, `RUNNING`, com Execution Root `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`, base integrada `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`, parent `ea4bcaa9fd8d2b3de0f079ac05f3ba00165a3d1b` e branch `mvo/p4-pr03-replay-rehydration`. A implementação, o Security Review e o Reviewer estão concluídos; o Reviewer emitiu `REVIEW_READY_FOR_AUDITOR`; a primeira auditoria foi `AUDIT_BLOCKED` somente por documentação, independence evidence e authorization; o Auditor recheck emitiu `AUDIT_GREEN — P4_PR03_READY_FOR_INTEGRATOR`. O Integrator está autorizado somente a fazer push e abrir/atualizar PR contra `phase-2/runtime-v0`; merge permanece proibido; a closure-record da PR #19 já está integrada e não é unidade contratual nova nem contém código/runtime/testes; P4-PR04 permanece fora de escopo.

## Estado atual de P4-PR03 — MERGE_READY versionado

- P4-PR03 permanece `RUNNING`; P4-PR04 permanece `PENDING`.
- Execution Root técnico: `d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; opening Control Root: `de47fd7a3f919a7094a16c051548cef0a47bf51a`; current Control Root anterior ao registro: `8e819a9633f70c210b663db4edea53f6350ed347`.
- O Auditor pré-merge emitiu `MERGE_READY`, com `MERGE_READY_MUST_BE_VERSIONED_BEFORE_MERGE` e blockers `NONE`; a determinação foi versionada documentalmente antes do merge.
- A PR #21 pode seguir para merge protegido; o estado técnico continua `RUNNING` até regressão pós-merge e Auditor final independente. Nenhuma mudança técnica foi introduzida por esta reconciliação.

## Estado atual de P4-PR03 — pós-merge aguardando Auditor final

- A PR #21 foi integrada em `b95b15a61b549eaa779b26b034cea4d57adf9e74` por merge commit, preservando o head aprovado `cf44e9b728884bcd1452a1e8e4fef0470e7d341e` como segundo parent; o primeiro parent/base é `cd7113febd147925cc5a5ab3557cb1d2ea48d1dc`.
- A árvore do merge é idêntica à árvore do head aprovado; o delta base→merge contém somente os 16 paths da PR #21, sem workflow/package/deploy drift e sem path inesperado. `git diff --check` ficou GREEN.
- Regressão pós-merge: `npm ci` GREEN; focused P4-PR03 `29/29`; focused transcript/P4-PR02 `42/42`; `npm test` passou `251/251` na reexecução imediata. A primeira execução foi `251/252` por `EBADF` assíncrono isolado em `test/kernel.test.ts`; não se repetiu, não corresponde ao D-013 e foi preservado como fato para o Auditor final.
- O reconciliador no checkout limpo da base integrada retornou exclusivamente `BLOCKED_STATE_DIVERGENCE` / `git_branch_mismatch:phase-2/runtime-v0`; isto é `EXPECTED_BRANCH_CONTEXT_DIVERGENCE` do guard branch-aware, não drift da árvore integrada. Os gates equivalentes foram executados sem veto separado.
- P4-PR03 permanece `RUNNING`, não `PROVEN`; P4-PR04 permanece `PENDING` e proibida. O próximo ator único é Auditor final independente, em sessão nova e read-only.
- A TASK do Auditor final deve julgar mecanicamente: `EXECUTION_ROOT_SHA=d63a19c2fb5da3fe8f781dba18b7abe75b9f4d7a`; `PRE_MERGE_CONTROL_ROOT_SHA=cf44e9b728884bcd1452a1e8e4fef0470e7d341e`; `MERGE_SHA=b95b15a61b549eaa779b26b034cea4d57adf9e74`; parents/base e segundo parent acima; PR #21 merged; árvore/diff/path scope; `npm ci`, focused `29/29`, transcript `42/42`, primeira `251/252` com `EBADF`, reexecução `251/251`, diff-check, reconciliador e ausência de drift. Deve decidir se a evidência satisfaz o veredito final definido pelo contrato e se P4-PR03 pode ser marcada `PROVEN`; não deve iniciar P4-PR04, alterar código, repetir Security Review/Reviewer ou fazer merge/deploy.
