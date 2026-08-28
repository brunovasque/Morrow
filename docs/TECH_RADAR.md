# Morrow Tech Radar

O radar registra tecnologias/padrões externos que podem acelerar o Morrow sem misturar tendência com regra constitucional.

**Última revisão:** 2026-08-28

## Estados

- `ADOPT` — padrão/tecnologia aprovada para uso quando aplicável;
- `TRIAL` — deve ser testada em spike controlado antes de virar dependência canônica;
- `ASSESS` — acompanhar/pesquisar; ainda sem compromisso;
- `HOLD` — não escolher para trabalho novo sem nova evidência.

## Radar atual

| item | estado | uso potencial | motivo/reserva | revisar quando |
|---|---|---|---|---|
| Agent Skills | ADOPT | empacotamento portátil de skills | usar padrão aberto + sidecar de governança Morrow | especificação mudar materialmente |
| MCP | ADOPT | fronteira de tools/resources | kernel mantém allowlist/permissões | nova versão relevante ou limitação encontrada |
| LangGraph.js | TRIAL | checkpoint/resume/workflow state | comparar contra kernel mínimo antes de fixar dependência | Runtime V0 spike |
| OpenHands patterns | ASSESS | sandbox/event stream/runtime separation | reutilizar padrões/componentes, não produto inteiro por padrão | spike de sandbox/runtime |
| SWE-agent ACI patterns | ASSESS | interfaces estreitas de ferramentas/trajectories | forte referência para agent-computer interface | design de tool capability sets |
| A2A | ASSESS | interoperabilidade externa entre agentes | provavelmente desnecessário no loop interno V0 | necessidade real de agentes remotos/terceiros |
| Microsoft Agent Framework | ASSESS | workflows/checkpoints | referência forte, mas stack inicial aponta TypeScript | expansão multi-runtime |
| Google ADK | ASSESS | session/memory/artifact/workflow patterns | referência conceitual e possíveis adapters | quando houver caso Google/provider específico |
| MetaGPT | ASSESS | papéis/SOPs de software company | tese útil; evitar pipeline fixo | benchmark de primeiro contrato |
| CrewAI | ASSESS | ergonomia de crews/flows | não substituir governança própria | necessidade de workflow de negócio |
| AutoGen original | HOLD | multi-agent framework | não usar como fundação nova enquanto projeto original estiver em maintenance mode | status do projeto mudar |

## Regra de frescura

Cada decisão arquitetural que depende de projeto externo deve registrar versão/data quando virar dependência real.

O radar deve ser reavaliado quando:

- dependency entra em deprecation/maintenance;
- surge padrão aberto que reduz lock-in;
- provider lança capacidade que elimina adaptação própria;
- dados internos mostram piora de custo/qualidade;
- uma capability importante está prestes a ser implementada do zero.

## Relação com STATE_OF_ART_SCAN

O radar é atalho para o que já sabemos, não substituto de pesquisa fresca. `STATE_OF_ART_SCAN` decide se o item ainda é adequado para o contrato/capability atual.

## Regra

**Governança do Morrow deve ser estável; implementação commodity pode evoluir.** O radar permite modernizar o motor sem trocar o significado de contrato, papel, memória, evidência ou gate.