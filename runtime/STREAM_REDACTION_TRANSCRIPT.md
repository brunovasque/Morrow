# Stream Redactor, retenção e transcript persistente — P4-PR02

- contract: `MORROW-MVO-001`
- PR-ID: `P4-PR02`
- estado: `PROVEN (PR #18 e closure-record PR #19 integradas; P4-PR03 é a próxima unidade)`
- formato durável: `morrow.transcript/1.0`
- implementação: `src/stream-transcript.ts`
- candidate de código anterior `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`: `SUPERSEDED`/`INVALIDATED` antes de novo A-001, após contraprovas adicionais encontrarem superfícies ainda não cobertas; não houve novo A-001 sobre `dc0bbaf`
- candidate de código atual: `76a41db64343131dfc20b699bedfae491859f88b`
- candidate anterior `189c1ced569489508ceb7d052f5e2b521cf085dd`: `SUPERSEDED`/`INVALIDATED` após A-001 `BLOCKED` por DoS algorítmico por newline fragmentado
- candidate `95e808294395449b46438b799c0b7d480cece52d`: `SUPERSEDED`/`INVALIDATED` após A-001 `BLOCKED` por dois P2; não é prova de integração
- candidate anterior `15e3ac733fc295d4cff3762de957f348a6e02c01`: `SUPERSEDED`/`INVALIDATED` após A-001 `BLOCKED` por reconstrução VT CSI `b` / REP
- candidate predecessor `ba350658a39f270cbc9ec559c193997a1a0db047`: `SUPERSEDED`/`INVALIDATED` após A-001 `BLOCKED` por composição HPA + DCH
- provas do candidate anterior `95e808` reportadas pelo Executor: focused `35/35` GREEN; primeira regressão completa `206/207`, com única falha correspondente ao histórico `D-013`; `npm run probe:conpty-soak` posteriormente GREEN com 12 sessões, PIDs distintos, `noOrphans: true` e fixture removida; reexecução completa `207/207` GREEN; `git diff --check` GREEN; A-001 foi executado e ficou `BLOCKED`
- provas do candidate atual `189c1ce`: focused `39/39` GREEN; `npm test` `211/211` GREEN; `D-013` não apareceu nessa execução; `git diff --check` GREEN

## Reconciliação factual do candidate atual

O Executor reproduziu REDs para opção CLI sensível; assignment JSON com whitespace multiline antes do separador; custo superlinear ao receber string-control incompleto fragmentado; e tratamento incorreto de terminador C1 em OSC, causando over-redaction. As causas foram o boundary genérico sem reconhecimento da chave sensível após opção CLI, whitespace anterior ao separador sem CR/LF, `release()` reprocessando o `pending` crescente e `terminalOscEnd()` sem reconhecer C1-ST. A correção implementada no candidate `95e808294395449b46438b799c0b7d480cece52d`, parent `84f095d87b6f3852d736f8cb11bbfa2d56efd2d6`, usa reconhecimento estrutural de opções CLI sensíveis, whitespace estrutural multiline, scanner incremental bounded de terminal/string-control entre chunks e reconhecimento de C1-ST em OSC, preservando as cercas CSI/VT estruturais já presentes. O candidate contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.

As medições reportadas para string-control incompleto do candidate anterior caíram de ordem de segundos para poucos milissegundos no mesmo envelope de `4k/8k/12k/16k`. `D-013` permanece aberto e não foi corrigido, escondido ou alterado. Não houve alteração de ConPTY/P3, push, merge ou deploy.

## A-001 bloqueado do candidate `95e808`

O Security Reviewer independente, nova sessão Luna `xhigh`, revisou `3657a070e5dc6b1e7b78fa1804761440c55efffc..95e808294395449b46438b799c0b7d480cece52d` e emitiu `BLOCKED`. Os dois P2 foram: controle C1 stateful não reconhecido que o normalizador descartava genericamente, permitindo reconstrução visual de chave sensível em live, `inspect()` e snapshot persistido; e custo superlinear sob fragmentação, pois `push()` levava `release()` a recalcular `#ranges()` sobre `pending`, com aproximadamente 1.024/82 ms, 2.048/255 ms, 4.096/957 ms, 8.192/2.633 ms e 16.384/6.014 ms, assignments até aproximadamente 4.292 ms em 8.192 bytes. O focused foi `35/35` GREEN; a primeira `npm test`, `207/207`; o soak falhou posteriormente somente em `D-013`; a segunda `npm test`, `206/207`, com a única falha também `D-013`; transcript/redaction verde; `git diff --check` GREEN; worktree final limpa. `95e808` está superseded/invalidated e não é prova de integração.

## Correção posterior — candidate `189c1ce`

O Executor reproduziu os dois P2. A correção fechou estruturalmente C0/C1, mantendo descartáveis somente controles comprovadamente textualmente inertes e levando controles stateful, cursor/linha/tabulação/display/charset/flow-control/reservados ou desconhecidos a fail-closed. Na fragmentação, o primeiro cruzamento continua sendo redigido normalmente; scans seguintes são amortizados/batched; newline força reavaliação; `finish()` executa classificação final; `pending` continua bounded e nenhuma liberação ignora o redactor. O candidate `189c1ced569489508ceb7d052f5e2b521cf085dd`, parent `b1a3bdedf2d6131702661403bf31251761e8602a6`, tem a mensagem `fix(p4-pr02): harden terminal controls and amortize stream scans` e contém somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`.

Conferência externa independente anterior ao commit confirmou fragmentação de 1 byte rápida além do holdback; texto comum em 2k/4k/8k/12k/16k aproximadamente `4.9 / 3.5 / 6.7 / 9.1 / 10.6 ms`; assignment seguro aproximadamente `1.4 / 1.6 / 3.9 / 6.2 / 7.5 ms`; focused independente `39/39` GREEN; somente os dois arquivos autorizados modificados. `189c1ce` ainda não possui A-001 válido; P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; `D-013` continua dívida histórica aberta e não foi corrigida; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi feito. Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..189c1ced569489508ceb7d052f5e2b521cf085dd`.

## A-001 bloqueado do candidate `189c1ce`

O A-001 completo do candidate `189c1ced569489508ceb7d052f5e2b521cf085dd` foi executado por Security Reviewer independente Luna `xhigh`, em nova sessão, e terminou `BLOCKED`. O review revalidou como verdes as classes anteriores C0/C1, CSI/VT, OSC/APC/DCS/PM/SOS, assignments, CLI/JSON/YAML/PowerShell, live/`inspect()`/persistência/reopen e complexidade dos cenários comuns. O único finding bloqueante foi P2 — DoS algorítmico por newline fragmentado: focused `39/39` GREEN; primeira `npm test` `210/211`, única falha em `D-013`/ConPTY; `npm run probe:conpty-soak` somente com `D-013`; segunda `npm test` `211/211` GREEN; `git diff --check` GREEN; worktree limpa; medições aproximadas `8k 1,429s`, `12k 2,834s`, `16k 4,256s`. A causa foi newline furar a janela de amortização e forçar `#ranges()` repetidamente sobre aproximadamente o holdback.

`189c1ce` está `SUPERSEDED`/`INVALIDATED` e seu A-001 não é prova de integração. O Executor reproduziu RED e removeu a exceção que fazia newline furar batching: newline permanece pendente até janela amortizada ou `finish()`, sem threshold artificial ou parser novo. CRLF, multiline, C0/C1, CSI/VT, string-controls e demais cercas foram preservados.

## Candidate atual `76a41db` — sem A-001 válido

O candidate atual é `76a41db64343131dfc20b699bedfae491859f88b`, parent `479f44d8ecfe9668ac64ff8a9d547f82caf81f7d`, mensagem `fix(p4-pr02): amortize newline stream scans`, contendo somente `src/stream-transcript.ts` e `test/stream-transcript.test.ts`. Provas do Executor: focused `42/42` GREEN; `npm test` `214/214` GREEN; `git diff --check` GREEN; D-013 não apareceu; somente os dois arquivos autorizados foram alterados. Conferência externa pré-commit mediu LF `2k/4k/8k/12k/16k` em aproximadamente `2,34 / 3,46 / 7,54 / 8,17 / 9,06 ms` e CRLF em `1,52 / 1,86 / 3,99 / 7,91 / 9,17 ms`; chunk único e 1-byte produziram saída equivalente; contraprova sensível terminou sem canário; após controle ConPTY, regressão completa `214/214` GREEN.

`76a41db` ainda não possui A-001 válido. P4-PR02 permanece `RUNNING` / `BLOCKED ON A-001`; merge continua proibido; P4-PR03 continua não autorizada; D-013 permanece aberto; nenhum código P3/ConPTY foi alterado; nenhum push, merge ou deploy foi realizado. Próximo ator: Security Reviewer independente, nova sessão Luna `xhigh`, read-only, revisando `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`.

## A-001 GREEN_LOCAL do candidate `76a41db`

O A-001 completo foi executado por Security Reviewer independente GPT-5.6 Luna, effort `xhigh`, `quota-session`, sem API, em sessão nova e somente-leitura, sobre o delta integral `3657a070e5dc6b1e7b78fa1804761440c55efffc..76a41db64343131dfc20b699bedfae491859f88b`. O veredito foi `GREEN_LOCAL_A-001`. Foram registrados focused `42/42` GREEN, `npm test` `214/214` GREEN, `git diff --check` GREEN, D-013 ausente, probe ConPTY desnecessário, worktree final limpa, nenhum arquivo rastreado alterado pelo Reviewer e nenhum push, merge ou deploy.

A cobertura independente incluiu C0/C1; CSI, REP, movimentos, insert/delete/erase, queries/private/intermediates; SGR; OSC/APC/DCS/PM/SOS; formas 7-bit/C1 e incompletas; CR/LF/CRLF/backspace; assignments bare/camel/Pascal/snake/kebab/dotted/quoted; CLI; Authorization/Bearer/tokens/private keys; JSON/YAML/PowerShell e multiline; chunk único, chunks arbitrários e 1-byte; boundaries; live fragment por fragmento; `inspect()`/snapshot/reopen; abort/capacity; autorização; retenção; checksum; root safety; symlink/junction; getters/proxies/objetos hostis; frozen/detached. Nenhum canário alcançou live, `inspect()`, disco ou reopen; findings P1, P2, P3 e informational de segurança: nenhum. As fronteiras 4095/4096/4097/8191/8192/8193 passaram sem liberação de canário.

As medianas independentes em chunks de 1 byte, para 2k/4k/8k/12k/16k, foram: comum `1.591 / 1.617 / 4.745 / 5.668 / 7.213 ms`; assignment seguro `0.988 / 1.870 / 3.558 / 5.762 / 8.417 ms`; terminal `1.071 / 1.837 / 3.802 / 4.330 / 5.917 ms`; string-control `0.714 / 1.376 / 2.450 / 3.658 / 5.127 ms`; LF `0.774 / 1.530 / 3.733 / 6.203 / 9.835 ms`; CRLF `0.891 / 1.696 / 3.383 / 5.570 / 8.887 ms`; combinado adversarial `0.974 / 2.010 / 5.963 / 6.158 / 8.104 ms`.

Este registro cobre somente a passagem do gate A-001 exigido para o candidate atual. `GREEN_LOCAL_A-001` não equivale ao Security Review externo indisponível, não cria precedente para outras PRs, não torna P4-PR02 `PROVEN` e não autoriza por si só integração ou merge. P4-PR02 permanece `RUNNING`; integração e regressão pós-merge ainda requerem etapa contratual posterior. P4-PR03 não foi iniciada.

## Fronteira obrigatória

Nenhum produtor grava ou entrega texto humano diretamente ao storage ou à futura UI. O caminho permitido é:

```text
chunk não confiável -> TranscriptRecordWriter -> StreamRedactor -> fragmento seguro -> snapshot seguro
```

O writer mantém lookbehind limitado para reconhecer valores divididos entre chunks. Um scanner iniciado na chave sensível mantém também prefixos incompletos com espaços antes de `:`/`=` ou do valor. Em assignment quoted, a faixa continua aberta mesmo quando passa de 4.096 caracteres; o scanner contextual reconhece backslash, backtick de PowerShell e quote duplicada, sem confundir quote escapada com fechamento. PowerShell multiline permanece protegido até a quote real; YAML quoted atravessa continuação estrutural válida, plain scalar termina em boundary YAML/flow/comment e block scalar usa indentação/dedent, inclusive dentro de sequence item. Se CR/LF terminar uma quote genérica sem fechamento, toda a faixa anterior à quebra é redigida antes que o restante seja liberado. Somente fragmentos já redigidos são devolvidos para espelhamento; o restante fica apenas em memória até poder ser classificado com segurança. Exceder os limites encerra a sessão sem gravar o conteúdo pendente.

Antes do matching, uma visão textual do terminal é calculada com mapeamento para os bytes/caracteres brutos. Controles C0/C1, backspace, sequências VT/ANSI/OSC e string controls APC/DCS/PM/SOS, format controls Unicode, bidi/zero-width e variation selectors são removidos do transcript público; string control é consumido até ST, e sequência incompleta permanece fail-closed entre chunks. Cursor rewrite completo ou ainda incompleto cobre desde o início da linha afetada, enquanto CRLF continua sendo quebra estrutural. A normalização mantém incrementalmente o início bruto/visível da linha e emite no máximo um range fail-closed por linha afetada; controles repetidos não podem revarrer início/fim da mesma linha nem acumular um range integral por controle. Um segredo cujos caracteres foram separados por controles é redigido como um único intervalo bruto. Assim um renderer futuro não pode reconstruir visualmente um canário que o matcher só deixou de ver por causa de escape sequence ou caractere invisível. O transcript P4 é texto humano seguro, não um buffer de emulação de terminal.

Para CSI, a política é estruturalmente fail-closed: somente SGR numérico comprovadamente inerte é descartado; HPA, DCH, ICH, ECH, IL, DL, movimentos, REP, save/restore, queries, private modes, intermediários e finais válidos não alfabéticos, além de CSI desconhecido ou não comprovado, são tratados como mutáveis e redigem a linha afetada. Parser e classificador usam a mesma noção de final CSI (`0x40..0x7E`). String controls completos OSC/APC/DCS/PM/SOS são classificados separadamente, consumidos e descartados em suas formas 7-bit e C1 equivalentes; incompletos permanecem fail-closed. A assimetria 7-bit/C1 detectada no primeiro diff foi corrigida antes do commit do candidate atual.

Valores sensíveis conhecidos são registrados explicitamente na política runtime e substituídos por `[REDACTED]`. A lista de valores nunca entra no snapshot, em hash, em log ou no resultado público. Literais que contenham ou sejam substring de qualquer marcador gerado são recusados para preservar a idempotência da redaction. Reconhecedores fechados também cobrem assignments sensíveis com chave nua ou quoted, componentes underscore de environment variables como `DB_PASSWORD`/`AWS_SECRET_ACCESS_KEY`, campos Authorization até CR/LF, bearer tokens, formatos comuns de token e private keys. Eles são defesa adicional: um segredo real não registrado continua proibido na origem, não vira uma permissão implícita para persistir.

O stream `input` é sempre sensível por padrão. Seu texto é descartado e o transcript guarda no máximo `[SENSITIVE_INPUT_REDACTED]`; não existe flag capaz de liberar stdin em claro.

## Política explícita

Abrir o store exige, sem defaults silenciosos:

- `redaction.policyId` e os valores sintéticos/secretos conhecidos somente em memória;
- `access.writerIds` e `access.readerIds` exatos;
- `retention.maxAgeMs`, `maxRecords`, `maxTotalBytes` e `maxRecordBytes`;
- raiz absoluta dedicada, canonicalizada, inicialmente vazia e marcada pelo Morrow.

Leitura e escrita recusam actor fora das listas. A política pública de acesso/retenção e o `policyId` são persistidos; restart com policy drift falha fechado. `maxTotalBytes` mede o conteúdo humano retido, enquanto o snapshot completo ainda possui teto estrutural independente de 16 MiB.

Retenção remove primeiro registros expirados e depois os mais antigos quando count/bytes ultrapassam a política. Cada commit/sweep informa os record IDs removidos; o ordinal interno não é reciclado.

## Persistência

O único artefato durável é `transcript-v1.json`:

- gravação temporária e rename atômico, ambos contendo somente dados já redigidos;
- checksum sobre formato, revisão, política e registros;
- validação exata de chaves, tipos, writer autorizado, ordinal, tempo não decrescente até `updatedAt` e limites total/individual por registro no reopen;
- nova passada do redactor sobre cada registro carregado; texto que hoje seria redigido torna o snapshot inválido;
- lease publicada atomicamente evita dois writers concorrentes; no Windows MVO, remoção stale exige mutex de named pipe derivado da raiz, releitura do mesmo PID/token e deixa apenas uma abertura vencer; o SO libera o mutex se o recuperador cair;
- reopen remove somente temporários de snapshot/lease cujo nome Morrow confere exatamente, evitando que restos de crash contornem a retenção sem apagar arquivos alheios;
- a primeira abertura só adota raiz vazia e publica `.morrow-transcript-root.json`; reopen recusa marcador inválido ou qualquer entrada alheia;
- cada ancestral existente é validado antes de criar componentes ausentes; raiz/snapshot simbólico, junction ancestral ou canonicalização divergente é recusada antes de leitura ou escrita, com comparação case-insensitive somente no Windows.

O objeto retornado por `inspect()` é cópia destacada e profundamente congelada. Estado, valores da política, lookbehind bruto e capability de commit usam campos privados reais de JavaScript; o matcher também é método `#` real, e prototype/instância do redactor são congelados para impedir override por consumer JavaScript. `private` apagável do TypeScript não é tratado como cerca. O commit interno exige ainda uma capability não exportada, impedindo bypass do writer por consumidor JavaScript. Mensagens de erro são códigos estáveis e não propagam texto vindo de objetos hostis.

## Fronteiras das próximas unidades

- replay, cursores e reidratação de cliente: P4-PR03;
- produtores/API e observabilidade ponta a ponta de sessões reais: P4-PR04;
- dashboard, terminal renderer e controles de UI: P5;
- armazenamento de credencial real não pertence ao transcript; continua atrás do Secret Broker.

## Fechamento final pós-merge — `P4_PR02_PROVEN_READY`

P4-PR02 foi provada após a integração da PR de produto `#18` no merge commit `3738d7877cc1613e363adee8063322eefb595528`, com parents `3657a070e5dc6b1e7b78fa1804761440c55efffc` e `46167607c6f0c55a7f48eec2464a7cbda327dc22`. O candidate A-001 `76a41db64343131dfc20b699bedfae491859f88b` e o head integrado `46167607c6f0c55a7f48eec2464a7cbda327dc22` são ancestrais, a árvore do merge é idêntica à árvore do head integrado e não houve drift ou path inesperado.

O gate de segurança foi `GREEN_LOCAL_A-001`, explicitamente não equivalente ao Security Review externo indisponível e sem precedente para outras PRs. O Auditor pré-merge emitiu `MERGE_READY`; o Auditor final emitiu `P4_PR02_PROVEN_READY`. A regressão pós-merge foi: `npm ci` GREEN; focused `42/42`; `npm test` `214/214`; `git diff --check` GREEN; D-013 não ocorreu; findings finais P1/P2/P3: nenhum; blocker: nenhum.

O reconciliador da closure-record branch, após o commit e com worktree limpa, retornou exatamente `allowed: false`, `state: BLOCKED_STATE_DIVERGENCE`, `nextPrId: P4-PR03`, `nextAuthorizedAction: START_P4_PR03` e `reasons: [git_branch_mismatch:mvo/p4-pr02-proven-record]`. No checkout detached da conferência, a decisão auditada é `EXPECTED_DETACHED_CONTEXT_DIVERGENCE`, porque `git branch --show-current` é vazio e o reconciliador é branch-aware; isso não representa regressão do artefato integrado.

PR #18 permaneceu o único veículo de integração do produto/código. Depois do merge, o registro final `PROVEN` foi transportado por PR documental #19 e integrado no merge `a7f0f49efa630f927ac22f56d8cd0ce2032664cc`. A closure-record não é unidade contratual nova, não contém código/runtime/testes, não reinicia A-001, não reinicia regressão de produto e não constitui P4-PR03. P4-PR03 ainda não foi iniciada e não está bloqueada por essa closure-record.

As provas desta PR usam apenas canários sintéticos e raízes temporárias sob `.morrow-test-tmp` no próprio repositório Morrow.
