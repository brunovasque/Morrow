# Gate de pré-despacho

Nenhum papel executa se o manifesto de contexto estiver incompleto.

## Manifesto obrigatório

Cada despacho deve registrar e entregar, no mínimo:

1. `contract_id`, versão/hash do contrato original e adendos vigentes;
2. `map_step` e objetivo observável exato da etapa;
3. hash/versão do snapshot da **memória viva** entregue;
4. papel e versão/hash do invariante carregado;
5. target, base SHA e workspace isolado aplicável;
6. artefatos/arquivos autorizados, escopo de leitura e limites de escrita;
7. critérios positivos de conclusão;
8. regression manifest/contraprovas obrigatórias e, em execução filha, `regression_inheritance_manifest`;
9. decisões do dono vigentes;
10. perguntas bloqueantes abertas/resolvidas e decisões de reuniões que afetam a etapa;
11. débitos/achados relevantes, sem promovê-los automaticamente a objetivo;
12. classificação de escopo vigente quando a etapa nasceu de achado/correção de rota;
13. memória institucional `PROMOTED` aplicável ao papel/objetivo;
14. skills autorizadas, com versão;
15. capacidades/ferramentas exigidas e confirmação de disponibilidade;
16. configuração efetiva de routing: `manual | assisted | automatic`, access mode, runtime/modelo e effort;
17. limites de tempo, tentativas, cota/reserva e budget API quando aplicável.

## Recusa determinística

O runtime deve recusar o despacho antes de chamar qualquer LLM quando:

- faltar campo obrigatório;
- existir decisão bloqueante aberta;
- o contrato/adendo exigido não estiver aprovado;
- o papel não possuir a capacidade/permissão exigida;
- o workspace/target/base não corresponder ao autorizado;
- a rota de acesso/effort não puder ser satisfeita sem downgrade silencioso;
- houver `DESTINATION_CHANGE` sem adendo/novo contrato;
- uma execução filha não possuir a anti-regressão herdada do contrato-pai;
- uma cerca obrigatória conhecida não estiver incluída no regression manifest.

## Prova de carregamento

O runtime registra hashes/versões do contexto efetivamente entregue. O agente não pode apenas declarar que "leu a memória"; a orquestração precisa provar qual contexto foi anexado à execução.

## Memória não é prompt solto

Contrato, mapa, memória viva, decisões, skills e aprendizado promovido são resolvidos pelo kernel e anexados conforme manifesto. Uma sessão reiniciada deve poder ser reidratada sem depender do histórico conversacional anterior.

Este gate existe para que memória, escopo, regressão, routing e invariantes não dependam da boa vontade do modelo.