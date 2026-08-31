# Stream Redactor, retenção e transcript persistente — P4-PR02

- contract: `MORROW-MVO-001`
- PR-ID: `P4-PR02`
- estado: `GREEN_CANDIDATE`
- formato durável: `morrow.transcript/1.0`
- implementação: `src/stream-transcript.ts`

## Fronteira obrigatória

Nenhum produtor grava ou entrega texto humano diretamente ao storage ou à futura UI. O caminho permitido é:

```text
chunk não confiável -> TranscriptRecordWriter -> StreamRedactor -> fragmento seguro -> snapshot seguro
```

O writer mantém lookbehind limitado para reconhecer valores divididos entre chunks. Um scanner iniciado na chave sensível mantém também prefixos incompletos com espaços antes de `:`/`=` ou do valor. Em assignment quoted, a faixa continua aberta mesmo quando passa de 4.096 caracteres e aspas escapadas não a encerram. Se CR/LF terminar a linha sem fechar a aspa, toda a faixa anterior à quebra é redigida antes que o restante seja liberado. Somente fragmentos já redigidos são devolvidos para espelhamento; o restante fica apenas em memória até poder ser classificado com segurança. Exceder os limites encerra a sessão sem gravar o conteúdo pendente.

Antes do matching, uma visão textual do terminal é calculada com mapeamento para os bytes/caracteres brutos. Controles C0/C1, backspace, sequências VT/ANSI/OSC, format controls Unicode, bidi/zero-width e variation selectors são removidos do transcript público; um segredo cujos caracteres foram separados por esses controles é redigido como um único intervalo bruto. Assim um renderer futuro não pode reconstruir visualmente um canário que o matcher só deixou de ver por causa de escape sequence ou caractere invisível. O transcript P4 é texto humano seguro, não um buffer de emulação de terminal.

Valores sensíveis conhecidos são registrados explicitamente na política runtime e substituídos por `[REDACTED]`. A lista de valores nunca entra no snapshot, em hash, em log ou no resultado público. Literais que contenham ou sejam substring de qualquer marcador gerado são recusados para preservar a idempotência da redaction. Reconhecedores fechados também cobrem assignments sensíveis, componentes underscore de environment variables como `DB_PASSWORD`/`AWS_SECRET_ACCESS_KEY`, bearer tokens, formatos comuns de token e private keys. Eles são defesa adicional: um segredo real não registrado continua proibido na origem, não vira uma permissão implícita para persistir.

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

O objeto retornado por `inspect()` é cópia destacada e profundamente congelada. Estado, valores da política, lookbehind bruto e capability de commit usam campos privados reais de JavaScript; `private` apagável do TypeScript não é tratado como cerca. O commit interno exige ainda uma capability não exportada, impedindo bypass do writer por consumidor JavaScript. Mensagens de erro são códigos estáveis e não propagam texto vindo de objetos hostis.

## Fronteiras das próximas unidades

- replay, cursores e reidratação de cliente: P4-PR03;
- produtores/API e observabilidade ponta a ponta de sessões reais: P4-PR04;
- dashboard, terminal renderer e controles de UI: P5;
- armazenamento de credencial real não pertence ao transcript; continua atrás do Secret Broker.

As provas desta PR usam apenas canários sintéticos e raízes temporárias sob `.morrow-test-tmp` no próprio repositório Morrow.
