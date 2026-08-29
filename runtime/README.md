# Runtime

A Fase 0/1 definiu a governança e as fronteiras do runtime. A próxima fase implementará o primeiro trilho executável sem acoplar papel a modelo, target ou topologia.

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

O serviço local que protege a raiz do Worker e expõe seu ciclo de vida sem ainda executar trabalho está em [`LOCAL_WORKER_SERVICE.md`](LOCAL_WORKER_SERVICE.md).

Os registries versionados de Target/Role/Skill/Capability e a fronteira opaca do Secret Broker estão em [`GOVERNANCE_REGISTRIES.md`](GOVERNANCE_REGISTRIES.md).
