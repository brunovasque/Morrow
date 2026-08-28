# Adendos do contrato

Adendo é o único mecanismo para ampliar, restringir ou esclarecer formalmente o destino contratado sem apagar o contrato original.

## Regra

Contrato aprovado é imutável como registro histórico. Adendo não edita o passado; ele acrescenta uma decisão versionada e explicitamente autorizada.

## Quando usar

Use adendo somente quando uma descoberta ou decisão:

- altera critério de aceitação;
- altera deliverable;
- altera comportamento externo esperado;
- altera escopo contratado;
- altera restrição/invariante do destino;
- incorpora trabalho que antes estava explicitamente fora do contrato.

Correção de rota, ordem operacional, papel ou método não exige adendo se o destino permanecer idêntico; isso pertence ao mapa.

## Registro

| addendum_id | requested_by | reason | original_clause | approved_change | impact_on_map | impact_on_regression | owner_approval | effective_at |
|---|---|---|---|---|---|---|---|---|

## Gate

Nenhum agente pode executar trabalho que dependa de adendo enquanto `owner_approval` não estiver comprovado.

Depois da aprovação:

1. o Contract Engineer consolida a interpretação;
2. o Orchestrator atualiza a memória viva;
3. o mapa é refeito somente nas linhas impactadas;
4. perguntas/regressões afetadas são reabertas;
5. o PRE_DISPATCH passa a carregar contrato original + adendos vigentes.

## Proibição

Reunião de agentes, diagnóstico, consenso técnico, urgência ou facilidade de implementação não substituem autorização de adendo quando o destino muda.