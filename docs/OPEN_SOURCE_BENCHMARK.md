# Benchmark open source — padrões para o Morrow

Este documento registra decisões de desenho, não código copiado. Antes de reutilizar implementação de terceiros, confira licença e mantenha atribuição exigida.

## 1. Agent Skills

**Ideia forte:** skill como pasta portátil com `SKILL.md`, scripts, referências e assets; carregamento progressivo para evitar despejar conhecimento inteiro no contexto.

**Decisão Morrow:** ADOTAR O PADRÃO em vez de inventar formato incompatível. O Morrow adiciona governança num sidecar próprio sem quebrar a skill portátil.

## 2. OpenHands

**Ideias fortes:**
- separar Agent, State, EventStream e Runtime;
- ação -> execução em sandbox -> observação;
- sandbox isolado para código arbitrário;
- skills/instruções por repositório;
- eventos como espinha dorsal de observabilidade.

**Decisão Morrow:** ADOTAR OS PADRÕES, não o produto inteiro. Sandbox e event log são prioridades do Runtime V0.

## 3. SWE-agent

**Ideias fortes:**
- Agent-Computer Interface (ACI): qualidade da interface/ferramentas afeta fortemente o agente;
- conjuntos de ferramentas estreitos em vez de shell irrestrito para cada papel;
- estado do ambiente devolvido após ação;
- trajectories completas para reproduzir execução;
- limites de timeout/custo e filtros de comando.

**Decisão Morrow:** cada papel recebe uma capability set mínima; toda invocação produz trajectory/eventos reproduzíveis.

## 4. LangGraph / LangGraph.js

**Ideias fortes:**
- checkpoint a cada superstep;
- resume após falha/interrupção;
- pending writes para não repetir trabalho concluído;
- time travel/replay;
- paralelismo, retry e human-in-the-loop;
- implementação TypeScript disponível.

**Decisão Morrow:** CANDIDATO PRINCIPAL para o motor de checkpoint/workflow do primeiro spike, porque evita recriar persistência/resume e preserva continuidade com runtime TypeScript. Ainda não é dependência canônica até o spike comparar custo/complexidade com kernel mínimo próprio.

## 5. Microsoft Agent Framework

**Ideias fortes:** workflows explícitos, executors/edges, checkpoints, estado compartilhado, padrões sequential/concurrent/handoff e retomada.

**Decisão Morrow:** usar como referência de contrato de workflow e checkpoint. Não é base inicial porque o runtime do Morrow está apontando para TypeScript e o framework concentra Python/.NET.

## 6. Google ADK

**Ideias fortes:** separação Agent / Runner / Tool / Session / Memory / Artifact; seleção dinâmica de agentes; workflows sequenciais e paralelos; estado explícito.

**Decisão Morrow:** adotar a separação conceitual e o padrão de seleção dinâmica. Nem todo contrato deve acordar cada papel.

## 7. MetaGPT

**Ideia forte:** "software company" composta por papéis e SOPs; requirement -> product/architecture/project/engineering.

**Decisão Morrow:** a tese confirma o caminho do Morrow, mas NÃO adotar o pipeline fixo. O Morrow preserva papéis independentes, gates, memória institucional e seleção dinâmica por contrato.

## 8. CrewAI

**Ideias fortes:** crews + flows, memória/knowledge, guardrails e observabilidade em uma camada de alto nível.

**Decisão Morrow:** referência útil para ergonomia futura e workflows de negócio. Não substituir a governança do kernel.

## 9. A2A

**Ideia forte:** protocolo aberto para descoberta de capacidades e colaboração entre agentes independentes de fornecedor/framework.

**Decisão Morrow:** reservar compatibilidade futura na fronteira externa. Não usar A2A para comunicação interna do V0 se um event envelope local for mais simples.

## 10. MCP

**Ideia forte:** interface padronizada entre agentes e ferramentas/recursos externos.

**Decisão Morrow:** ferramenta externa preferencial deve poder ser exposta por MCP ou por adapter equivalente. MCP não governa o workflow; o kernel governa permissões e despacho.

## 11. AutoGen

O projeto original está em maintenance mode e recomenda Microsoft Agent Framework para projetos novos.

**Decisão Morrow:** não escolher AutoGen como fundação nova. Manter apenas os padrões conceituais úteis de message passing/event-driven agents.

---

# Ordem de preferência para reutilização

1. usar um padrão aberto;
2. usar biblioteca como dependência;
3. escrever adapter fino;
4. fork somente se houver motivo operacional forte;
5. copiar código somente quando dependência/fork forem inadequados, com revisão de licença e atribuição.

O Morrow não deve virar um mosaico de frameworks. Reutilizamos infraestrutura difícil e commodity; preservamos como propriedade do Morrow a governança de contrato, papéis, gates, memória institucional e política de aprendizado.