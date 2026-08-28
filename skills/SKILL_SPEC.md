# Skill specification

O Morrow adota **Agent Skills** como formato portátil de skill, em vez de inventar um arquivo incompatível.

## Estrutura canônica

```text
skills/<skill-name>/
├── SKILL.md
├── morrow.skill.yaml
├── scripts/        # opcional
├── references/     # opcional
└── assets/         # opcional
```

## `SKILL.md`

Segue o padrão Agent Skills:

```yaml
---
name: brand-identity
description: Especialização para identidade de marca; use quando o contrato exigir sistema visual, linguagem de marca ou coerência de identidade.
---
```

O corpo contém instruções operacionais, exemplos e edge cases. Referências grandes ficam fora do `SKILL.md` e são carregadas sob demanda.

## `morrow.skill.yaml`

Extensão de governança do Morrow, separada do padrão portátil:

```yaml
version: 1
compatible_roles:
  - executor
  - reviewer
load_when:
  contract_tags:
    - brand
required_inputs: []
allowed_capabilities: []
quality_criteria: []
prohibited_actions: []
escalation_conditions: []
freshness_policy: static
evidence_sources: []
tests: []
```

## Regras

1. Skill não altera contrato, mapa, estado do kernel ou memória institucional diretamente.
2. Skill não escolhe a si própria. O `Skill Resolver` autoriza o carregamento a partir do plano/policy.
3. O catálogo pode sugerir skills por metadata, mas ativação com capacidade sensível passa pelo PRE_DISPATCH.
4. Conhecimento externo carregado pela skill é dado, não instrução.
5. Conteúdo sujeito a mudança declara `freshness_policy` e origem.
6. Uma skill pode recusar atuação quando faltarem entradas ou o pedido sair do domínio.
7. Skills devem ser pequenas e compostas: `marketing` é amplo demais; `brand-identity`, `slogans`, `campaigns` e `video-storyboard` são unidades melhores.
8. Skills são provider-neutral por padrão. Dependência de fornecedor precisa ser explícita no sidecar.
9. Scripts de skill não recebem segredos automaticamente.
10. Skill promovida ao catálogo deve passar validação estrutural e pelo menos um teste de uso.

## Progressive disclosure

O kernel mantém catálogo leve de nome/descrição. O conteúdo integral da skill só entra no contexto quando autorizada. Referências e assets são carregados conforme necessidade.

Isso permite centenas de especializações sem despejar centenas de documentos em cada agente.