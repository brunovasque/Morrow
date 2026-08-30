# Runtime

A Fase 0/1 definiu a governança e as fronteiras do runtime, e a Fase 2 entregou o Local Worker governado. A Fase 3 substitui a automação por pipes pelo terminal real apenas onde as capabilities forem provadas, sem acoplar papel a modelo, target ou topologia.

## Princípio de execução

O runtime deve ser **determinístico nas cercas e flexível na rota**.

Ele garante mecanicamente:
- contrato/destino ativo;
- permissões e capabilities;
- contexto obrigatório;
- scope drift veto;
- anti-regressão;
- evidência e revalidação quando algo muda;
- autoridade do dono quando necessária;
- registro de eventos e memória viva.

Ele NÃO deve impor uma esteira cognitiva rígida. Agentes podem:
- abrir reunião em qualquer momento relevante;
- voltar a diagnóstico;
- repetir experimento;
- refazer implementação;
- solicitar nova revisão;
- auditar novamente;
- reabrir prova ou mapa;

desde que preservem o destino contratado, respeitem permissões e não quebrem comportamento aceito.

O grafo governado está descrito em `CONTRACT_STATE_MACHINE.md`.

## Próximo marco

Runtime V0 deve provar:
1. event log persistente;
2. estado/memória viva reidratável;
3. PRE_DISPATCH determinístico;
4. AgentInstance efêmero;
5. workspace isolado;
6. retorno/loop livre entre papéis com causa registrada;
7. um adapter quota-session real sem exigir API.
8. sessão processual própria por agente, com saída incremental observável;
9. múltiplas sessões simultâneas em workspaces distintos;
10. fronteira explícita entre terminais do operador e terminais gerenciados.

A experiência de operação que governa esses itens está em [`OPERATOR_EXPERIENCE.md`](OPERATOR_EXPERIENCE.md). Backend por pipes prova automação, streaming e ciclo de vida; compatibilidade de terminal interativo na interface exige PTY/ConPTY e não pode ser simulada por resumos.

O protocolo versionado entre Control Plane e Local Worker, suas fronteiras de confiança e o limite entre referência de trabalho e execução estão em [`ADR_WORKER_CONTROL_PROTOCOL.md`](ADR_WORKER_CONTROL_PROTOCOL.md).

O serviço local que protege a raiz do Worker e expõe seu ciclo de vida está em [`LOCAL_WORKER_SERVICE.md`](LOCAL_WORKER_SERVICE.md).

A ligação autenticada entre WorkSpec, autoridade, PRE_DISPATCH, routing/guards, lock, workspace, PowerShell determinístico e AgentInstance está em [`AUTHENTICATED_DISPATCH.md`](AUTHENTICATED_DISPATCH.md).

A fila durável, os estados online/offline, o reconnect governado e a regra fail-closed de kill/restart estão em [`WORKER_RECOVERY.md`](WORKER_RECOVERY.md).

A decisão state-of-art do terminal Windows, a fronteira substituível de backend e o capability gate que impede chamar pipes de terminal completo estão em [`ADR_WINDOWS_TERMINAL_BACKEND.md`](ADR_WINDOWS_TERMINAL_BACKEND.md).

A implementação real da P3-PR02, sua ativação protegida por Job Object, interrupções distinguíveis, drenagem e provas de ausência de descendentes órfãos estão em [`WINDOWS_CONPTY_BACKEND.md`](WINDOWS_CONPTY_BACKEND.md).

Os registries versionados de Target/Role/Skill/Capability e a fronteira opaca do Secret Broker estão em [`GOVERNANCE_REGISTRIES.md`](GOVERNANCE_REGISTRIES.md).

A resolução auditável de routing/access/model e as reservas determinísticas de cota e budget estão em [`ROUTING_GUARDS.md`](ROUTING_GUARDS.md).
