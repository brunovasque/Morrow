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