# Gate de pré-despacho

Nenhum papel executa se o manifesto de contexto estiver incompleto.

## Manifesto obrigatório

Cada despacho deve registrar e entregar, no mínimo:

1. `contract_id` e versão/hash do contrato ativo;
2. `map_step` e objetivo observável da etapa;
3. papel e versão/hash do invariante carregado;
4. artefatos/arquivos autorizados;
5. escopo de leitura;
6. critérios positivos de conclusão;
7. contraprovas/regressões obrigatórias;
8. limites de tempo, tentativas e budget;
9. decisões do dono já resolvidas e ainda abertas;
10. memória institucional PROMOTED aplicável ao papel/objetivo;
11. skills autorizadas, com versão;
12. capacidades/ferramentas exigidas e confirmação de disponibilidade.

## Recusa determinística

O runtime deve recusar o despacho antes de chamar qualquer LLM quando faltar campo obrigatório, quando a decisão necessária estiver aberta ou quando o papel não possuir a capacidade exigida.

## Prova de carregamento

O runtime registra hashes/versões do contexto efetivamente entregue. O agente não pode apenas declarar que "leu a memória"; a orquestração precisa provar qual contexto foi anexado à execução.

Este gate existe para que memória e invariantes não dependam da boa vontade do modelo.
