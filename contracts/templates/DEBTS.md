# Registro de achados e débitos do contrato

Um achado lateral não autoriza desvio do objetivo ativo. Ele é registrado aqui e classificado antes de qualquer trabalho adicional.

## Estados

- `FOUND` — fato/risco/oportunidade detectado, ainda não triado;
- `BLOCKING_CONTRACT` — sem resolver, o contrato atual não cumpre o destino/critério aceito;
- `DEFERRED_DEBT` — real e relevante, mas fora do destino contratado atual;
- `INVALIDATED` — medição posterior mostrou que não era débito real;
- `CHILD_EXECUTION_OPEN` — aprovado para execução posterior vinculada ao contrato-pai;
- `CLOSED` — débito posterior provado e anti-regressão herdada aprovada.

## Registro

| debt_id | found_in_step | found_by | description | evidence | relation_to_contract | regression_risk | status | owner_decision | child_execution | date |
|---|---|---|---|---|---|---|---|---|---|---|

`relation_to_contract` deve ser exatamente uma:

- `required-for-current-contract`
- `outside-current-contract`
- `unknown-needs-triage`

## Regra de não desvio

Enquanto `relation_to_contract` não for medida/decidida, o achado não entra no mapa como trabalho executável.

Se for `required-for-current-contract`, ele **não é dívida adiável**: vira bloqueio do contrato e a rota deve ser corrigida sem alterar o destino.

Se for `outside-current-contract`, não pode ser corrigido de passagem. Fica registrado para decisão no fechamento ou em momento posterior.

## Triagem no fechamento

Antes de fechar o contrato, cada `FOUND` deve terminar em `BLOCKING_CONTRACT`, `DEFERRED_DEBT` ou `INVALIDATED`.

Pergunta obrigatória:

> Sem resolver isto, o estado observável entregue ainda satisfaz integralmente o contrato aprovado?

- se `não`: bloqueia o fechamento;
- se `sim`: pode ser débito posterior;
- se `não medível`: não fingir resposta; escalar/medir.

## Execução posterior

Um `DEFERRED_DEBT` aprovado para correção cria uma execução filha com:

- `parent_contract_id`;
- `origin_debt_id`;
- objetivo próprio e mínimo;
- baseline no estado entregue pelo contrato-pai;
- **regression inheritance manifest** com todos os critérios/invariantes relevantes já aceitos;
- testes próprios do débito;
- Reviewer/Auditor conforme risco.

Fechar o débito exige passar `DEBT_CLOSE_REGRESSION`. Corrigir o débito e quebrar o contrato-pai é falha, não progresso.