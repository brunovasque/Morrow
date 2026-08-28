# Template — mapa de erros do papel

**Papel:** `<role_id>`

Este arquivo registra defeitos do modo de trabalho do papel, não defeitos do produto.

## Ocorrências

| error_id | first_seen | last_seen | occurrences | contract_ids | signature | classe/causa | evidência | quem detectou | evitável no preflight? | gate/skill/tool envolvido | status | candidate/promoted link |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|

`signature` descreve a classe generalizável do erro, não o texto específico de um contrato.

## Classes sugeridas

- `SPECIFICATION`
- `MISSING_CONTEXT`
- `PREFLIGHT`
- `DIAGNOSTIC`
- `EXECUTION_MAP`
- `ROLE_HANDOFF`
- `SKILL_GAP`
- `TOOLING`
- `MODEL_BEHAVIOR`
- `ROUTING_EFFORT`
- `TEST_REGRESSION_GAP`
- `REVIEW_AUDIT_GAP`
- `ENVIRONMENT`
- `UNKNOWN`

## Estados

- `OBSERVED`
- `REPEATED`
- `CANDIDATE_LEARNING`
- `MITIGATED`
- `PROMOTED_GUARD`
- `SUPERSEDED`
- `REVOKED`

## Régua

- ocorrência única: registra sem inventar generalização;
- ocorrência com mesma assinatura em outra rodada: incrementa, não cria linha duplicada;
- falha grave única pode virar candidato se o mecanismo causal for claro e verificável;
- padrão não vira regra sozinho: vai ao Supervisor/LEARNING_PROMOTION;
- promoção deve apontar onde será carregada/executada e qual erro pretende impedir;
- depois da promoção, continuar medindo ocorrências para saber se a solução funcionou;
- se a regra não reduzir o erro ou causar dano, propor revisão/remoção em vez de empilhar outra camada.

## Regra

O mapa de erros não é um arquivo para o agente "lembrar de ler". O Memory Resolver consulta assinaturas aplicáveis e injeta aprendizados promovidos via PRE_DISPATCH.