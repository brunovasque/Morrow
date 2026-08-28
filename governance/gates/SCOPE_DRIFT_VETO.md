# Gate SCOPE_DRIFT_VETO

Desvio de destino é inaceitável, mesmo quando a mudança parece tecnicamente boa, barata ou conveniente.

## Pergunta do gate

Antes de autorizar trabalho novo ou ampliar uma etapa:

> Esta ação é necessária para atingir exatamente o estado observável aprovado ou está criando outro produto/objetivo?

## Classificação

- `IN_SCOPE_ROUTE` — muda método/ordem/implementação, mas preserva integralmente o destino;
- `REQUIRED_BLOCKER` — achado não previsto, porém sem resolvê-lo o contrato atual não pode ser cumprido;
- `OUT_OF_SCOPE_DEBT` — relevante, mas o contrato pode ser integralmente entregue sem corrigi-lo;
- `DESTINATION_CHANGE` — muda deliverable, critério de aceitação, comportamento externo, escopo ou invariante aprovado;
- `UNMEASURED` — não há evidência suficiente para classificar.

## Ações

- `IN_SCOPE_ROUTE`: pode atualizar o mapa, com registro;
- `REQUIRED_BLOCKER`: bloqueia a etapa e entra no mapa como correção de rota, mantendo o destino;
- `OUT_OF_SCOPE_DEBT`: registrar em `DEBTS.md` e não executar agora;
- `DESTINATION_CHANGE`: parar; exige adendo aprovado ou novo contrato;
- `UNMEASURED`: parar e medir/diagnosticar.

## Proibições

Não são justificativas válidas para ultrapassar o gate:

- "já que estamos neste arquivo";
- "é só uma melhoria pequena";
- "vai ficar mais limpo";
- "evita trabalho futuro";
- "o agente acha melhor";
- "todos na reunião concordaram".

Consenso técnico não possui autoridade para trocar o destino.

## Evidência

Toda classificação deve apontar para cláusula/critério do contrato ou para evidência de que o contrato não pode ser cumprido sem a ação.

Sem vínculo demonstrável, o trabalho não entra na execução atual.