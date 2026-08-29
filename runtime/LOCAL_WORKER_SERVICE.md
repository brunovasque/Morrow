# Serviço Local Worker — P2-PR02 + dispatch P2-PR05 + recovery P2-PR06

O Local Worker é o processo local do Morrow que hospeda execução governada. P2-PR02 criou o serviço sem dispatch; P2-PR05 acrescentou um attachment interno e revogável, documentado em [`AUTHENTICATED_DISPATCH.md`](AUTHENTICATED_DISPATCH.md). P2-PR06 acrescenta o coordenador durável documentado em [`WORKER_RECOVERY.md`](WORKER_RECOVERY.md): fila offline, reconnect por hello/heartbeat e bloqueio conservador quando restart deixa o resultado de um efeito incerto. O serviço continua sem listener de rede, credencial real, target implícito ou terminal completo.

## Configuração explícita

O host recebe um único arquivo JSON de configuração. O formato aceito é estrito:

```json
{
  "workerId": "worker-local-1",
  "managedRoot": "C:\\...\\.morrow\\workers\\worker-local-1",
  "operatorOwnedRoots": ["C:\\...\\meu-projeto"],
  "supportedProtocolVersions": ["1.0"]
}
```

`managedRoot` precisa ser absoluto e conter o segmento `.morrow`. `operatorOwnedRoots` declara diretórios que jamais podem se sobrepor à raiz do Worker. A configuração não possui `targetId`, comando, script, ambiente, token ou chave para habilitar dispatch; campos extras — inclusive `dispatchEnabled` — são recusados.

## Posse da raiz

Ao iniciar, o Worker:

1. cria a raiz somente se ela estiver vazia;
2. grava o marcador `.morrow-local-worker-root.json` com seu `workerId`;
3. cria somente `state`, `workspaces` e `diagnostics` abaixo da raiz;
4. recusa raiz sem marcador e com conteúdo, marcador de outro Worker, qualquer ancestral simbólico/junction ou filho que não seja diretório gerenciado;
5. confirma que o caminho canônico, depois de resolvido pelo sistema operacional, continua dentro de um segmento `.morrow` antes de aceitar a raiz.

Assim, uma pasta de projeto aberta pelo operador não é adotada por acaso como área de trabalho do Morrow. O Worker não recebe nenhum target nesta etapa.

## Ciclo de vida

Estados expostos: `stopped`, `starting`, `ready`, `stopping` e `failed`.

- `start()` é idempotente enquanto o Worker está `ready`;
- `stop()` é idempotente e não remove a raiz aprovada;
- uma nova instância pode subir depois sobre a mesma raiz marcada, recebendo novo `instanceId`;
- `status()` declara explicitamente `targetAccess: none`; `dispatchAccepted` só fica verdadeiro quando o Worker está `ready` e a composição interna anexou um dispatcher autenticado vivo por `attachAuthenticatedDispatch()`;
- parar o Worker revoga esse attachment; restart exige nova composição, impedindo status verde herdado sem dispatcher;
- cada attachment possui identidade própria: um manipulador de detach antigo ou repetido não pode revogar o attachment criado depois de um restart;
- `diagnose()` verifica configuração, isolamento das raízes, marcador e filhos gerenciados sem tocar em target externo.

## Host local

`src/local-worker-host.ts` inicia o serviço com um arquivo de configuração e emite linhas JSON `LOCAL_WORKER_READY` e `LOCAL_WORKER_STOPPED`. O processo aceita somente a linha exata `STOP` pelo stdin herdado do seu supervisor local, além dos sinais de encerramento do sistema. Esse canal não transporta tarefa, comando, target ou payload do Cérebro; o protocolo Worker/Control Plane da P2-PR01 continua separado.

O host ainda não é um serviço Windows instalado/autostart e seu stdin não transporta dispatch. Instalação, ACL de serviço e operação diária sem terminal manual pertencem a P8-PR01. A ligação autenticada P2-PR05 é uma fronteira de runtime separada.

## Composição de recovery

O host básico continua sem transportar trabalho pelo stdin. A composição confiável conecta o protocolo autenticado ao `WorkerRecoveryCoordinator`; o coordenador só entrega o corpo governado à fronteira de tentativa depois do checkpoint `running`. Um restart nunca herda status `online`: a nova instância exige nova sessão e heartbeat.

O estado fica em filho gerenciado de `stateRoot`, nunca no projeto/terminal do operador. O snapshot não contém envelope, credencial, script, prompt nem saída de processo.

## Fora destas etapas

- transporte remoto concreto: fora desta PR; o MVO local-first pode compor a fronteira localmente e qualquer topologia remota futura continua outbound conforme a P2-PR01 e os débitos `D-004/D-009`;
- Target/Role/Skill/Capability/Secret registries: P2-PR03;
- routing, quota e budget: P2-PR04;
- dispatch sem WorkSpec imutável, autoridade, guards, lock e workspace: proibido; o caminho aceito é P2-PR05;
- eventos canônicos, transcript/redaction e replay de observabilidade: P4;
- ConPTY e terminais reais: P3.
