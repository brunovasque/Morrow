# Deployment topology — local, cloud and hybrid

Morrow não deve nascer preso a uma única topologia.

## Decisão inicial

O desenho preferencial é **hybrid-capable, local-first para quota/session**.

A razão é operacional: runtimes autenticados por assinatura/cota, worktrees locais e ferramentas instaladas no computador do operador podem exigir execução local. Ao mesmo tempo, state store, event log, scheduler, UI, filas e workers baseados em API podem migrar para nuvem quando isso trouxer benefício.

## Componentes

### Control plane

Pode rodar local ou em nuvem:
- contratos e state machine;
- event log;
- policy/gate engine;
- scheduler;
- memória;
- routing;
- UI/CLI;
- registry de targets/connectors.

### Worker

Executa AgentInstances e workspaces. Pode ser:
- `local-worker` — usa filesystem, worktrees, CLIs e sessões de cota locais;
- `cloud-worker` — sandbox/container remoto com APIs/credenciais próprias;
- `dedicated-worker` — máquina/VM privada de um projeto/cliente.

### Connector runtime

Pode estar no mesmo worker ou remoto, desde que capability, autenticação e auditoria permaneçam governadas pelo kernel.

## Topologias suportadas

### 1. All-local

Control plane + workers na máquina local. Melhor primeiro modo para desenvolvimento e uso pessoal com quota/session.

### 2. Hybrid

Control plane persistente em nuvem e workers locais conectados. Permite scheduler/UI/memória sempre disponíveis sem perder acesso às cotas e ferramentas locais.

### 3. Cloud

Control plane + workers remotos. Adequado a API/local models remotos e futuros serviços multiusuário, desde que políticas/licenças/autenticação permitam.

## Regra de portabilidade

Nenhum contrato deve depender do hostname ou caminho físico de uma máquina. O kernel referencia `worker_id`, `runtime_id`, `target_id`, `workspace_id` e capabilities.

Se um worker desaparecer, o contrato fica bloqueado/reagendável e pode ser reidratado em outro worker compatível a partir de estado persistente.

## Segurança

- secrets ficam no Secret Broker apropriado ao ambiente;
- workers recebem somente credenciais/capabilities necessárias;
- target privado não é copiado para worker não autorizado;
- quota/session local não deve ter suas credenciais exportadas para a nuvem;
- produção pode exigir worker/profile específico.

## Evolução

O Runtime V0 deve provar primeiro o caminho local. A fronteira worker/control-plane deve, porém, nascer explícita para permitir mover componentes para nuvem sem reescrever os papéis, contratos ou memória.