# Gate de encerramento do contrato

Um contrato só pode ser marcado como concluído quando cada condição abaixo tiver evidência registrada.

## Condições

1. critério de encerramento e todos os critérios de aceitação medidos;
2. etapas do mapa concluídas, superseded ou formalmente excluídas com motivo;
3. `REGRESSION_VETO` em `PASS` para o estado final;
4. testes e contraprovas obrigatórios realmente executados, não apenas existentes;
5. revisão e auditoria exigidas pelo risco concluídas;
6. Acceptance concluída contra o estado observável contratado;
7. nenhum `DESTINATION_CHANGE` executado sem adendo aprovado;
8. todos os achados/débitos triados como `BLOCKING_CONTRACT`, `DEFERRED_DEBT` ou `INVALIDATED`;
9. todo `BLOCKING_CONTRACT` resolvido antes do fechamento;
10. cada `DEFERRED_DEBT` preservado sem correção oportunista e vinculado ao contrato-pai;
11. decisões bloqueantes do dono resolvidas ou explicitamente tornadas irrelevantes por decisão válida;
12. artefatos finais, hashes, commits/PRs e evidências identificados e reproduzíveis;
13. snapshot final da memória viva congelado;
14. baseline/regression snapshot final preservado para futuras execuções filhas de débitos;
15. retrospectiva independente por papel e reunião coletiva concluídas;
16. Supervisor executado;
17. candidatos de aprendizado classificados, sem promoção automática;
18. métricas de autonomia/routing/cota registradas.

## Triagem de débitos

Para cada achado ainda aberto, perguntar:

> Sem resolver isto, a entrega ainda satisfaz integralmente o contrato aprovado?

- `não` → é bloqueio do contrato; não fecha;
- `sim` → pode permanecer como `DEFERRED_DEBT`;
- `não medível` → medir/escalar; não classificar por conveniência.

Débito posterior não é continuação informal desta execução. Se aprovado para trabalho futuro, nasce como execução filha e passa por `DEBT_CLOSE_REGRESSION`, herdando a anti-regressão do contrato finalizado.

## Snapshot de preservação

O fechamento produz uma referência imutável suficiente para reconstruir:

- contrato + adendos vigentes;
- critérios de aceitação;
- invariantes preservados;
- regression manifest e provas executadas;
- Acceptance final;
- target/base/candidate final;
- débitos deferidos e sua origem.

Esse snapshot é a régua do futuro. Fechar um débito não pode apagar o que o contrato-pai já provou.

## Métricas mínimas

- intervenções humanas;
- `PREFLIGHT_MISS` e `EMERGENT_UNKNOWN`;
- reuniões abertas e motivo;
- tentativas de scope drift bloqueadas;
- voltas por defeito de pedido;
- voltas por defeito de execução;
- regressões detectadas e escapadas;
- achados/débitos;
- duração;
- invocações e bloqueios por cota;
- configuração manual/assistida/automática usada;
- custo API, separado, quando houver.

Merge, deploy, código de saída zero, build verde ou mensagem de sucesso não substituem este gate.