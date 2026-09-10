# Eventos canônicos do Live Activity Feed — P4-PR01

- contract: `MORROW-MVO-001`
- PR-ID: `P4-PR01`
- estado: `PROVEN`
- schema: `morrow.live-activity` `1.0`
- artefato: `schema/live-activity.v1.schema.json`

## Objetivo

O feed não infere que algo está acontecendo a partir de texto, polling ou resumo do Cérebro. Cada item nasce de um evento canônico validado e o estado atual é materializado novamente a partir da sequência completa.

O envelope liga cada evento a contrato, step, `activityId` e `correlationId`. Quando existirem, `agentInstanceId`, `terminalSessionId` e `workspaceId` também ficam presos à primeira identidade da atividade e não podem mudar em eventos posteriores. `causationId` deve apontar para o evento anterior da mesma atividade; o primeiro dispatch usa `null`.

## Estados visíveis

O schema fecha os estados mínimos exigidos por AC-21:

- `dispatch`;
- `gate`;
- `tool`;
- `process`;
- `waiting-lock`;
- `waiting-quota`;
- `waiting-owner`;
- `blocked`;
- `failed`;
- `done`.

Cada transição registra somente identificadores estruturados: estado anterior/novo, `reasonCode`, tipo e id da fonte, actor e timestamp. Texto livre não faz parte do evento v1; redaction e transcript pertencem a P4-PR02.

## Reconstrução mecânica

`projectContractLiveActivity(contractId, events)` valida antes de projetar:

1. coleção e objetos plain com exatamente os campos do schema, sem elementos/propriedades herdados ou accessors;
2. schema e versão exatos;
3. ids/timestamp/sequence canônicos;
4. tipo da fonte coerente com a categoria visível (`quota` não pode fabricar `process`, por exemplo);
5. sequência contínua iniciada em 1, event ids únicos e tempo não regressivo;
6. contrato e identidade imutáveis por `activityId`;
7. `from` igual ao estado reconstruído;
8. `causationId` igual ao head reconstruído da atividade;
9. primeira transição obrigatoriamente para `dispatch`;
10. nenhuma transição depois de `blocked`, `failed` ou `done`.

Qualquer divergência falha fechado com código e índice do evento. Proxies/accessors hostis são recusados sem propagar sua exceção. Sem evento, a projeção é vazia: o feed não fabrica atividade.

Eventos e projeções aceitos são cópias destacadas e profundamente congeladas. Assim, mutar o objeto de entrada depois da validação não reescreve a evidência que a tela futura receberá.

## Fronteiras desta PR

P4-PR01 define schema, validação e projector puro. Não implementa ainda:

- persistência/redaction/transcript, que pertencem a P4-PR02;
- cursores, replay e reidratação de cliente, que pertencem a P4-PR03;
- produção/API de eventos de duas sessões reais, que pertence a P4-PR04;
- dashboard/UI, que pertence a P5.

O Event Log e o `LiveContractState` históricos permanecem compatíveis; o schema de Live Activity é um stream canônico separado até a integração explícita das próximas unidades.
