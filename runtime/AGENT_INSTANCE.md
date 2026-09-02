# Agent Instance

No Morrow, **papel é especificação persistente; agente em execução é instância efêmera**.

## Fórmula

```text
AgentInstance =
  RoleSpec
+ Contract/Map Step
+ Live Memory Snapshot
+ Skill Bundle
+ Capability Set
+ Target
+ Workspace
+ Routing Decision
+ Runtime Session
```

Essas dimensões não se confundem.

## Identidade mínima

Uma instância registra:

- `agent_instance_id`;
- `role_id` + versão do RoleSpec;
- `contract_id` / `map_step`;
- `target_id`;
- `workspace_id` quando necessário;
- skills/version;
- permissions/capabilities;
- context manifest hash;
- routing control mode;
- access mode;
- provider/model/runtime efetivos;
- effort efetivo;
- `terminal_session_id` quando houver processo observável;
- provider session/invocation IDs;
- start/end/status.

## Muitos agentes com o mesmo papel

Pode existir simultaneamente:

```text
Executor#contract-A
Executor#contract-B
Executor#contract-C
```

Todos obedecem ao mesmo RoleSpec, mas podem ter targets, workspaces, modelos e efforts diferentes.

Não existe obrigação de manter um único "Executor da empresa" vivo.

## Sessão não é memória

A sessão do provider pode morrer, resetar ou ser trocada. A identidade operacional continua reconstruível pelo kernel porque contrato, mapa, memória viva, artifacts e eventos ficam fora dela.

Uma nova sessão pode assumir a mesma etapa mediante novo PRE_DISPATCH e contexto reidratado.

O painel de terminal na interface é uma projeção observável dessa execução, não a identidade permanente do papel. Seu ciclo de vida continua separado de qualquer terminal aberto manualmente pelo operador, conforme [`OPERATOR_EXPERIENCE.md`](OPERATOR_EXPERIENCE.md).

## Papel sem workspace

Nem toda instância precisa de checkout próprio.

Orchestrator, Scribe ou Contract Engineer podem operar somente sobre control-plane artifacts/capabilities.

Diagnostician, Executor, Reviewer, Auditor etc. recebem workspace quando precisam observar/testar/escrever target.

## Independência

Reviewer/Auditor devem poder nascer em sessões e workspaces limpos, sem herdar automaticamente raciocínio privado do Executor.

A política pode exigir diversidade de modelo/provider para reduzir erro correlacionado, mas isso é configuração de routing, não identidade do papel.

## Encerramento

Quando a tarefa termina:

- resultado/eventos permanecem;
- workspace pode ser preservado por política ou descartado;
- sessão pode morrer;
- `AgentInstance` fica como registro histórico;
- RoleSpec continua disponível para novas instâncias.

## Regra

**Agente não é uma janela permanente. É uma execução governada de um papel em um contexto verificável.**
