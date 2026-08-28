# Rastreabilidade — MORROW-MVO-001

Este registro prova que requisitos conversados/canônicos possuem destino, fase/PR e critério de aceite. Linha sem cobertura bloqueia CONTRACT_PREFLIGHT.

| req-id | requisito | origem canônica | aceitação | PRs principais |
|---|---|---|---|---|
| `R-001` | Morrow funciona por contrato, mapa, estado vivo e gates; não por prompt solto | contracts/README + owner | AC-02, AC-03, AC-24 | P0, P7, P8 |
| `R-002` | Qualquer aba descobre estado e próximo passo sem depender da conversa | owner | AC-02, AC-03 | P0-PR01..03 |
| `R-003` | Objetivo mestre é Morrow mínimo operável, não produto infinito | owner | AC-22, AC-24 | P0, P8 |
| `R-004` | Operador usa seus terminais/projetos em paralelo | OPERATOR_EXPERIENCE + owner | AC-09, AC-17 | P1-PR04, P2, P3, P7 |
| `R-005` | Agentes trabalham em terminais próprios e reais visíveis na interface | OPERATOR_EXPERIENCE + OBSERVABLE_EXECUTION | AC-06, AC-07 | P3, P5-PR03 |
| `R-006` | Pipes não podem ser rotulados como terminal completo | OPERATOR_EXPERIENCE | AC-06 | P3-PR01/02 |
| `R-007` | Múltiplas sessões simultâneas com identidade e workspace distintos | OPERATOR_EXPERIENCE | AC-08 | P1-PR04, P3-PR04, P4-PR04 |
| `R-008` | Local Worker executa PowerShell/CLIs/workspaces locais | DEPLOYMENT_TOPOLOGY + owner | AC-01, AC-04, AC-13 | P2, P8-PR01 |
| `R-009` | PowerShell determinístico pode rodar sem LLM | owner decision | AC-04 | P2-PR05 |
| `R-010` | Trabalho semântico usa AgentInstance governada | AGENT_INSTANCE + owner | AC-05, AC-18 | P2-PR05, P7-PR02 |
| `R-011` | Cérebro/Orchestrator permanece separado do Local Worker | DEPLOYMENT_TOPOLOGY + owner | AC-05 | P2-PR01, P5-PR04, P7-PR02 |
| `R-012` | Chat Operador ↔ Cérebro é separado dos terminais | OPERATOR_EXPERIENCE + owner | AC-10 | P5-PR04 |
| `R-013` | Sala de reunião permite operador e papéis convidados | MEETING_ROOM + owner | AC-11 | P5-PR05, P7-PR06 |
| `R-014` | Atividade ao vivo vem de eventos/processos reais, não resumo fabricado | OBSERVABLE_EXECUTION | AC-07, AC-21 | P4, P5-PR02 |
| `R-015` | Stream humano e eventos estruturados coexistem | OBSERVABLE_EXECUTION | AC-03, AC-07, AC-21 | P4 |
| `R-016` | Segredos são redigidos antes de exibição/persistência | OBSERVABLE_EXECUTION + OPERATOR_EXPERIENCE | AC-16 | P4-PR02, P7-PR07 |
| `R-017` | Nexus delega/notifica opcionalmente, sem ser executor/autoridade | owner decision | AC-12 e operação sem Nexus | P6-PR04, P7-PR06 |
| `R-018` | Morrow possui Notification Gateway próprio | owner decision | AC-12 | P6-PR01..03 |
| `R-019` | Operador recebe pedido de decisão fora do PC e responde autenticado | owner decision | AC-12 | P6-PR02/03, P7-PR06 |
| `R-020` | PC desligado/suspenso não executa PowerShell local; trabalho espera | owner + deployment topology | AC-13, AC-20 | P2-PR06, P6-PR05 |
| `R-021` | Worker usa conexão outbound por padrão | contract invariant | AC-13, AC-16 | P2-PR01/02, P6-PR01 |
| `R-022` | Quota-session é primeira classe e API não é fallback silencioso | ACCESS_MODES/ROUTING_CONTROL | AC-14, AC-15 | P1-PR03, P3-PR03, P5-PR06 |
| `R-023` | Operador controla runtime/modelo/effort/pause/cancel | MANUAL_CONTROL_SURFACE + owner | AC-15, AC-20 | P5-PR06 |
| `R-024` | Reviewer/Auditor permanecem independentes | AGENT_INSTANCE/MEETING_ROOM | AC-19 | P7-PR02/03/05 |
| `R-025` | Evidência afetada por mudança é invalidada/reexecutada | CONTRACT_STATE_MACHINE | AC-19, AC-24 | P4, P7, P8 |
| `R-026` | Mudança gera branch/workspace/checks/candidato/PR; sem write direto em base | TARGET_REPOSITORY_MODEL | AC-18 | P7-PR04 |
| `R-027` | Restart/reconnect reidrata sem repetir efeitos | live memory/checkpoint requirements | AC-03, AC-20 | P2-PR06, P4-PR03, P7-PR06/07 |
| `R-028` | Estado de espera/falha é visível e distinto | OBSERVABLE_EXECUTION | AC-20, AC-21 | P4-PR01/03, P5-PR02 |
| `R-029` | Enova e outros targets não registrados não são tocados | owner + TARGET | AC-17 | todas; contraprova P7-PR07 |
| `R-030` | MVO fecha somente após instalação, prova real, audit e Acceptance | owner + CONTRACT_CLOSE | AC-01, AC-22, AC-23, AC-24 | P7, P8 |
| `R-031` | Futuras expansões não reabrem silenciosamente o MVO | owner + ADDENDA/DEBTS rules | AC-24 | P0, P8 |
| `R-032` | Somente instâncias ativas consomem sessão/cota; papel não é processo permanente | AGENT_INSTANCE/OBSERVABLE_EXECUTION | AC-05, AC-08, AC-14 | P2, P3, P7 |
| `R-033` | Worker/terminal não dependem de janela PowerShell mantida aberta pelo operador | OPERATOR_EXPERIENCE | AC-01, AC-09 | P2-PR02, P8-PR01/02 |
| `R-034` | O Morrow deve continuar operando mesmo com Nexus desconectado | owner decision | AC-12/AC-22 com Nexus off | P6-PR04, P7-PR06 |
| `R-035` | Target/Role/Skill/Capability/Secret/Routing/Quota/Budget são resolvidos mecanicamente antes do dispatch | KERNEL_SERVICES + PRE_DISPATCH | AC-25 | P2-PR03/04/05, P7-PR01 |
| `R-036` | Regressão herdada, debt flow, retrospectiva, Supervisor e aprendizado governado fazem parte do fechamento mínimo | memory/governance gates | AC-26 | P7-PR03/05/07, P8-PR03 |
| `R-037` | Operador não desenvolvedor parte de objetivo em linguagem comum, responde dúvidas e aprova contrato antes de writes | visão original + owner | AC-02, AC-27 | P5-PR04, P7-PR01/06, P8-PR02 |
| `R-038` | Papel, skill, modelo, sessão, workspace e target são separados; especialistas são extensíveis sem reescrever kernel | roles/skills + owner | AC-05, AC-25 | P2-PR03/04, P7-PR02 |
| `R-039` | Connector é adapter de capabilities mínimas; repo não concede infraestrutura/produção e providers adicionais são evolução | CONNECTOR_ARCHITECTURE + owner | AC-16, AC-17, AC-25; D-008 | P2-PR03, P6-PR04, P7-PR07 |
| `R-040` | Core público fica separado de control data, contratos, memória proprietária e credenciais privadas | TARGET_REPOSITORY_MODEL/ACCESS_MODES + owner | AC-16, AC-17 | P2-PR03, P4-PR02, P7-PR07 |
| `R-041` | Cercas são mecânicas, mas agentes podem voltar, questionar, reunir, diagnosticar e reauditar sem trocar o destino | CONTRACT_STATE_MACHINE/MEETING_ROOM + owner | AC-02, AC-11, AC-19, AC-26 | P7-PR01/02/03/06 |
| `R-042` | MVO é local-first, preserva topologia híbrida futura e não finge execução com PC desligado | DEPLOYMENT_TOPOLOGY + owner | AC-13; D-004/D-009 | P2-PR01/02/06, P6-PR05 |
| `R-043` | Escolhas técnicas relevantes são precedidas por pesquisa/medição atual e ADR para reduzir obsolescência | owner + state-of-art gates | critério técnico de rota sem mudar AC | P3-PR01, P5-PR01 e futuros connectors |
| `R-044` | Chat, UI, reunião e resposta externa não ganham autoridade por aparência; mutações exigem identidade/autorização/idempotência/anti-replay | Security Review P0-PR02 | AC-12, AC-20, AC-28 | P5-PR04, P6-PR01/03, P7-PR07 |
| `R-045` | Operação diária não exige Git/PowerShell manual do operador não desenvolvedor | Acceptance P0-PR02 + owner | AC-01, AC-10, AC-15, AC-27, AC-29 | P5, P7-PR06, P8-PR01/02 |

## Auditoria de completude

Antes de aprovar o contrato v1, P0-PR02 deve:

1. comparar novamente toda documentação em `runtime/`, `governance/`, `contracts/` e `memory/` aplicável;
2. verificar que cada AC possui ao menos uma linha aqui e uma PR em `PRS.md`;
3. verificar que cada PR mapeia para um deliverable/AC ou é removida como escopo indevido;
4. registrar qualquer requisito faltante como pergunta bloqueante, não como suposição;
5. obter confirmação do dono sobre objetivo/exclusões, não sobre detalhes técnicos de rota.

## Resultado preliminar

- requisitos conversados/canônicos mapeados: `45`
- requisitos sem AC/PR: `0` no draft atual
- revisão independente: `PENDING P0-PR02`
- owner acceptance do contrato: `PENDING`
