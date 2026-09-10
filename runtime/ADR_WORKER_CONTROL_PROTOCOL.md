# ADR — Protocolo entre Control Plane e Local Worker

- status: `ACCEPTED`
- decisão: `P2-PR01`
- versão do protocolo: `morrow.worker-control/1.0`
- schema canônico: [`../schema/worker-control.v1.schema.json`](../schema/worker-control.v1.schema.json)
- validação executável: [`../src/worker-protocol.ts`](../src/worker-protocol.ts)

## Contexto

O Cérebro/Orchestrator decide semanticamente o próximo trabalho. O Local Worker é um executor separado e governado; ele não é outro Cérebro e não ganha acesso implícito ao computador. O limite entre os dois precisa funcionar localmente no Windows agora e preservar uma topologia híbrida futura, sem acoplar o kernel a um transporte, provedor ou LLM.

P2-PR01 fixa somente a linguagem e as recusas dessa fronteira. Serviço persistente, transporte concreto, armazenamento de chaves, registries, execução de PowerShell/AgentInstance, recovery e ConPTY pertencem às PRs seguintes.

## Decisão

O V0 usa envelopes JSON estritos e versionados. Por padrão, o Worker inicia uma conexão de saída autenticada ao Control Plane; não é necessário abrir porta de entrada na máquina do operador. O transporte poderá ser local ou remoto, mas só entrega uma mensagem ao decoder depois de verificar a prova e produzir uma identidade autenticada.

O transporte limita cada mensagem UTF-8 a `262144` bytes antes do parse e recusa nomes de membro JSON duplicados. Whitespace excessivo, JSON parcial/concatenado e estruturas acima do limite não chegam ao decoder. Após validação, o decoder devolve uma cópia profundamente congelada para impedir alteração entre o gate e o consumo.

Cada envelope contém:

- protocolo e versão exatos;
- `messageId`, `correlationId` e `sequence`;
- remetente e destinatário com identidade lógica e de instância;
- janela curta `issuedAt`/`expiresAt`;
- prova vinculada ao transporte, credential id e nonce;
- autorização verificada para `dispatch` e `cancel`;
- corpo estrito por tipo de mensagem.

Campos desconhecidos são recusados. IDs e nonces repetidos são recusados. O validador não registra o replay window; P2-PR06 persiste e atualiza, no mesmo checkpoint atômico do aceite, hashes de IDs/nonces e a sequência por escopo autenticado. Valores de nonce, proof e credencial não são gravados.

## Fronteira de confiança

Validar JSON não autentica ninguém. `validateWorkerProtocolMessage` exige um `WorkerProtocolValidationContext` criado pelo adaptador de transporte depois de:

1. verificar criptograficamente a prova sobre o envelope canônico;
2. resolver a credencial para a identidade autenticada;
3. resolver a decisão de autorização vigente;
4. carregar a janela de replay e o relógio confiável;
5. definir a identidade local que deveria receber a mensagem.

O validador então confere que envelope, identidade autenticada, credencial, destinatário e decisão de autorização são os mesmos. `transport-bound-v1` descreve essa obrigação sem escolher antecipadamente mTLS, named pipe autenticado ou assinatura de aplicação; P2-PR02 mede e registra o mecanismo concreto. Nenhuma string `proof` é considerada verdadeira por existir.

A prova cobre o envelope inteiro, inclusive autorização e body, exceto o próprio campo `security.proof`. Quando o transporte exigir canonicalização de aplicação, o input é o separador de domínio `morrow.worker-control/<versão>` seguido do JSON canônico RFC 8785 do envelope sem `security.proof`. O credential resolver determina algoritmo/chave; aceitar uma prova que não esteja vinculada a esses bytes viola o protocolo.

## Tipos de mensagem

| tipo | direção | função | efeito permitido nesta PR |
|---|---|---|---|
| `worker.hello` | Worker → Control Plane | anuncia sessão, host, versão e capabilities reais | validação/negociação apenas |
| `worker.heartbeat` | Worker → Control Plane | renova liveness e informa dispatches ativos | validação da lease apenas |
| `control.dispatch` | Control Plane → Worker | referencia work spec imutável e workspace dedicado | nenhum processo é iniciado em P2-PR01 |
| `worker.ack` | Worker → Control Plane | confirma aceite, duplicação ou recusa | validação apenas |
| `control.cancel` | Control Plane → Worker | pede cancelamento idempotente com política de graça | nenhum sinal é enviado em P2-PR01 |
| `worker.reject` | Worker → Control Plane | devolve código mecânico e retryability | sem texto livre ou segredo |

## Dispatch sem poder implícito

`control.dispatch` não carrega comando, script, variável de ambiente, segredo ou caminho arbitrário. Ele referencia:

- um work spec imutável por `artifactId` + SHA-256;
- `contractId`, `stepId` e `targetId` explícitos;
- um `workspaceId` com isolamento obrigatório `dedicated`;
- capabilities requeridas;
- tipo `process | agent` e timeout limitado;
- `dispatchId` e `idempotencyKey` distintos.

A autorização verificada precisa conter os scopes de mensagem, criação de dispatch, contrato, etapa, target e cada capability. P2-PR03/P2-PR04 resolvem os registries/guards reais; P2-PR05 só poderá executar depois de todos passarem.

## Cancelamento

Cancel é outro comando autenticado e idempotente. Ele exige scopes `dispatch:cancel` e `dispatch:<id>`, motivo enumerado e política explícita `graceful | force-after-timeout`. Repetir o mesmo idempotency key não cria um segundo efeito. Um cancel desconhecido deve ser reconhecido como duplicado/rejeitado, nunca redirecionado para outro processo.

## Heartbeat e offline

Heartbeat contém `observedAt` e `leaseExpiresAt`; a lease precisa terminar depois da observação e não pode exceder dois minutos. A ausência de renovação fará o futuro Liveness Monitor marcar o Worker como indisponível. Ela não autoriza presumir que um processo terminou e não simula execução enquanto o PC está desligado.

## Compatibilidade

Versões usam `major.minor`. A negociação escolhe a maior versão **exatamente compartilhada** pelas duas pontas. Não existe suposição silenciosa de compatibilidade entre minors ou majors. Sem interseção, a conexão é recusada com `UNSUPPORTED_PROTOCOL`; migração futura adiciona decoder/schema explícito e testes de convivência.

Versão de protocolo e versão do serviço/agent são dimensões separadas. Capabilities também possuem versão própria `major.minor.patch`.

## Idempotência, ordenação e retry

- `messageId` identifica entrega e participa da janela de replay;
- `nonce` impede reutilização da prova;
- `idempotencyKey` identifica o efeito de dispatch/cancel entre retries;
- `sequence` deve crescer por sessão autenticada; valor igual ou menor que o último aceito é recusado como `OUT_OF_ORDER`, sem substituir replay/idempotência;
- `correlationId` liga conversa causal sem conceder autoridade;
- retry técnico reutiliza o idempotency key e cria novo message id/nonce/prova;
- `worker.ack: duplicate` é sucesso de entrega idempotente, não nova execução.

## Segurança e privacidade

- mensagens expiram em no máximo cinco minutos por padrão;
- mensagens maiores que 256 KiB ou com nomes JSON duplicados são recusadas antes do decoder;
- tolerância de relógio futuro é no máximo 30 segundos por padrão;
- campos extras e corpos que não correspondem ao tipo são recusados;
- direção Control Plane/Worker é fixa por tipo;
- autorização de mensagem não substitui Target/Capability/Secret/Quota/Budget Guards;
- o protocolo não transporta segredo ou conteúdo de terminal;
- logs futuros devem registrar IDs/códigos, nunca `proof` ou material de credencial;
- terminais e projetos do operador não são peers, targets ou workspaces válidos por inferência.

## Alternativas rejeitadas

- **Executar diretamente a partir de texto do chat:** mistura autoridade, intenção e shell; viola gates.
- **Worker com conexão inbound aberta por padrão:** aumenta superfície de ataque sem necessidade no MVO local-first.
- **Enviar comando PowerShell bruto no dispatch:** contorna work spec, target, capability e secret boundaries.
- **Confiar apenas em TLS ou em um campo `senderId`:** não prova autorização por contrato/target nem bloqueia replay.
- **Adotar A2A/MCP como protocolo interno agora:** são fronteiras úteis, mas não substituem as garantias internas específicas do contrato.

## Consequências

P2-PR02 pode implementar o serviço e transporte sem inventar semântica. P2-PR03/04 podem preencher decisões/registries sem alterar o envelope. P2-PR05 pode consumir somente mensagens já autenticadas, autorizadas e validadas. P3/P4/P5/P6 reutilizam IDs, correlação e estados sem acoplar terminal, UI, notificação ou Nexus ao Cérebro.
