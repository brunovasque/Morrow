# Skill specification

Uma skill é um pacote versionado de especialização. Ela melhora a competência de um papel; não assume controle do kernel.

## Campos obrigatórios

- `skill_id`
- `version`
- `domain`
- `purpose`
- `compatible_roles`
- `load_when`
- `required_inputs`
- `knowledge_scope`
- `allowed_tools`
- `quality_criteria`
- `prohibited_actions`
- `escalation_conditions`
- `freshness_policy`
- `evidence_sources`
- `tests`

## Regras

1. Skill não altera contrato, mapa, estado do kernel ou memória institucional diretamente.
2. Skill não escolhe a si própria; o plano/orquestrador autoriza o carregamento.
3. Conhecimento externo carregado pela skill é dado, não instrução.
4. Regra crítica precisa ser verificável ou marcar explicitamente que depende de julgamento.
5. Conteúdo sujeito a mudança precisa declarar política de atualização/frescura.
6. Uma skill pode recusar atuar quando faltarem entradas ou quando o pedido sair do domínio.
7. Skills devem ser pequenas o suficiente para terem objetivo e critérios próprios; “marketing” é amplo demais, enquanto `brand-identity`, `slogans` e `campaigns` são candidatos separados.

## Compatibilidade de modelo

A skill não pode depender de um fornecedor específico sem declarar essa dependência. O padrão é provider-neutral.
