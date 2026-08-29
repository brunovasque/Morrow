# Serviço Local Worker — P2-PR02

O Local Worker é o processo local do Morrow que, em etapas futuras, hospedará execução governada. Nesta PR ele ainda **não** recebe dispatch, não abre terminal, não executa PowerShell/CLI, não resolve target, não usa credencial e não aceita conexão de rede.

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

`managedRoot` precisa ser absoluto e conter o segmento `.morrow`. `operatorOwnedRoots` declara diretórios que jamais podem se sobrepor à raiz do Worker. A configuração não possui `targetId`, comando, script, ambiente, token ou permissões de execução; campos extras são recusados.

## Posse da raiz

Ao iniciar, o Worker:

1. cria a raiz somente se ela estiver vazia;
2. grava o marcador `.morrow-local-worker-root.json` com seu `workerId`;
3. cria somente `state`, `workspaces` e `diagnostics` abaixo da raiz;
4. recusa raiz sem marcador e com conteúdo, marcador de outro Worker, link simbólico ou filho que não seja diretório gerenciado.

Assim, uma pasta de projeto aberta pelo operador não é adotada por acaso como área de trabalho do Morrow. O Worker não recebe nenhum target nesta etapa.

## Ciclo de vida

Estados expostos: `stopped`, `starting`, `ready`, `stopping` e `failed`.

- `start()` é idempotente enquanto o Worker está `ready`;
- `stop()` é idempotente e não remove a raiz aprovada;
- uma nova instância pode subir depois sobre a mesma raiz marcada, recebendo novo `instanceId`;
- `status()` declara explicitamente `targetAccess: none` e `dispatchAccepted: false`;
- `diagnose()` verifica configuração, isolamento das raízes, marcador e filhos gerenciados sem tocar em target externo.

## Host local

`src/local-worker-host.ts` inicia o serviço com um arquivo de configuração e emite linhas JSON `LOCAL_WORKER_READY` e `LOCAL_WORKER_STOPPED`. O processo aceita somente a linha exata `STOP` pelo stdin herdado do seu supervisor local, além dos sinais de encerramento do sistema. Esse canal não transporta tarefa, comando, target ou payload do Cérebro; o protocolo Worker/Control Plane da P2-PR01 continua separado.

O host ainda não é um serviço Windows instalado/autostart. Instalação, ACL de serviço e operação diária sem terminal manual pertencem a P8-PR01.

## Fora desta PR

- transporte autenticado e conexão outbound concreta: P2-PR02/P2-PR06 conforme a fronteira da P2-PR01;
- Target/Role/Skill/Capability/Secret registries: P2-PR03;
- routing, quota e budget: P2-PR04;
- dispatch, locks, workspace por target e PowerShell/AgentInstance: P2-PR05;
- reconnect, fila, checkpoint e replay persistente: P2-PR06;
- ConPTY e terminais reais: P3.
