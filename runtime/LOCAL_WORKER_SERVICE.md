# Serviço Local Worker — P2-PR02 + ciclo de dispatch P2-PR05

O Local Worker é o processo local do Morrow que hospeda execução governada. P2-PR02 criou o serviço sem dispatch; P2-PR05 acrescenta um attachment interno e revogável, documentado em [`AUTHENTICATED_DISPATCH.md`](AUTHENTICATED_DISPATCH.md). O serviço continua sem listener de rede, credencial real, target implícito ou terminal completo.

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
- `diagnose()` verifica configuração, isolamento das raízes, marcador e filhos gerenciados sem tocar em target externo.

## Host local

`src/local-worker-host.ts` inicia o serviço com um arquivo de configuração e emite linhas JSON `LOCAL_WORKER_READY` e `LOCAL_WORKER_STOPPED`. O processo aceita somente a linha exata `STOP` pelo stdin herdado do seu supervisor local, além dos sinais de encerramento do sistema. Esse canal não transporta tarefa, comando, target ou payload do Cérebro; o protocolo Worker/Control Plane da P2-PR01 continua separado.

O host ainda não é um serviço Windows instalado/autostart e seu stdin não transporta dispatch. Instalação, ACL de serviço e operação diária sem terminal manual pertencem a P8-PR01. A ligação autenticada P2-PR05 é uma fronteira de runtime separada.

## Fora desta PR

- transporte autenticado, conexão outbound concreta e recovery: P2-PR06 conforme a fronteira definida na P2-PR01;
- Target/Role/Skill/Capability/Secret registries: P2-PR03;
- routing, quota e budget: P2-PR04;
- dispatch sem WorkSpec imutável, autoridade, guards, lock e workspace: proibido; o caminho aceito é P2-PR05;
- reconnect, fila, checkpoint e replay persistente: P2-PR06;
- ConPTY e terminais reais: P3.
