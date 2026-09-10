# Stream Redactor, retenção e transcript persistente — P4-PR02

- contract: `MORROW-MVO-001`
- PR-ID: `P4-PR02`
- estado: `BLOCKED_ON_A-001`
- formato durável: `morrow.transcript/1.0`
- implementação: `src/stream-transcript.ts`
- candidate de código anterior `dc0bbafbcf5c5b2b07f6ccddec081a465f296fcf`: `SUPERSEDED`/`INVALIDATED` antes de novo A-001, após contraprovas adicionais encontrarem superfícies ainda não cobertas; não houve novo A-001 sobre `dc0bbaf`
- candidate de código atual: `189c1ced569489508ceb7d052f5e2b521cf085dd`
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

As provas desta PR usam apenas canários sintéticos e raízes temporárias sob `.morrow-test-tmp` no próprio repositório Morrow.
