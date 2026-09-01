# Perguntas e incertezas — MORROW-MVO-001

## Status do preflight

- `question_round_state`: `COMPLETE`
- `blocking_question_count`: `0`
- `current_blocker`: `NONE`
- Pass 1 independente por papéis: `COMPLETE`
- Pass 2 adversarial: `COMPLETE`
- perguntas de destino abertas: `0`
- bloqueio atual: nenhum local; P1s spaced quoted key/YAML block foram corrigidos/contraprovados, aguardando publicação e revalidação; clock/inode/count/lease PID-only separados em `D-014`..`D-017`

As respostas abaixo consolidam decisões já dadas pelo dono e evidência do repositório. Elas foram atacadas independentemente por Contract Engineer, Architect, Test Designer, Security Reviewer e Acceptance antes de `READY_FOR_EXECUTION`.

## Registro consolidado

| id | levantada por | categoria | pergunta / hipótese | por que importa | fonte | status | resposta |
|---|---|---|---|---|---|---|---|
| `Q-01` | Owner | destination | A Fase 8 fecha todo o conceito ou o mínimo operável? | Evita objetivo infinito | owner | `RESOLVED` | Fecha o Morrow Mínimo Operável dentro do envelope do contrato; futuras capacidades são novos contratos. |
| `Q-02` | Owner | UX | O operador verá agentes em terminais reais próprios? | É o centro da experiência | owner + runtime docs | `RESOLVED` | Sim; PTY/ConPTY real e stream ao vivo. Pipes não contam como terminal final. |
| `Q-03` | Owner | isolation | Terminais/projetos do operador podem rodar em paralelo? | Evita interferência operacional | owner | `RESOLVED` | Sim; ficam fora do managed root e ciclo de vida do Morrow. |
| `Q-04` | Owner | architecture | PowerShell local exige outro Cérebro? | Evita duplicar inteligência | owner + deployment topology | `RESOLVED` | Não. Local Worker é executor governado; tarefas determinísticas podem dispensar LLM. |
| `Q-05` | Owner | integration | Nexus deve executar ou apenas delegar/notificar? | Define autoridade e acoplamento | owner | `RESOLVED` | Connector opcional; Morrow assume contrato e Worker executa. |
| `Q-06` | Owner | notification | Como o Morrow pede decisão fora do PC? | Requisito de autonomia prática | owner | `RESOLVED` | Notification Gateway próprio + pelo menos um canal externo autenticado; resposta entra no Decision Gateway/Cérebro. |
| `Q-07` | Architect | offline | O que acontece com PowerShell se o PC dormir/desligar? | Limite físico precisa ser visível | deployment topology | `RESOLVED` | Não executa. Worker fica offline; trabalho espera/bloqueia e retoma governadamente quando voltar. |
| `Q-08` | Architect | platform | Qual plataforma fecha o MVO? | ConPTY é específico | owner/environment | `RESOLVED` | Windows primeiro; arquitetura mantém backend portável, mas outras plataformas estão fora do aceite. |
| `Q-09` | Architect | terminal | Qual biblioteca/estratégia ConPTY será usada? | Dependência nativa e segurança | state-of-art required | `RESOLVED` | Windows ConPTY do sistema com `node-pty` `1.1.0` exato atrás da interface Morrow, sem winpty/DLL fallback; P3-PR02 provou compatibilidade, recebeu hardening adversarial e está autorizada para integração. |
| `Q-10` | Architect | UI | Desktop nativo, web local ou outra stack? | Afeta terminal rendering e distribuição | state-of-art required | `ROUTE_DECISION` | P5-PR01 decide por spike/ADR, mantendo todos os critérios de UX. |
| `Q-11` | Security Reviewer | network | Worker precisa aceitar conexão de entrada? | Aumenta superfície de ataque | owner architecture | `RESOLVED` | Não por padrão; conexão outbound autenticada. |
| `Q-12` | Security Reviewer | secrets | Transcript pode persistir prompts/entrada? | Pode vazar segredo | operator experience | `RESOLVED` | Entrada sensível não é persistida por padrão; redaction e política explícita precedem storage/UI. |
| `Q-13` | Orchestrator | access | API é necessária para operar? | Custo surpresa/credencial | access modes | `RESOLVED` | Não; quota-session/local são primeira classe e API nunca é fallback silencioso. |
| `Q-14` | Acceptance | target | Qual target prova o fluxo sem tocar Enova? | Evita risco externo | owner | `RESOLVED` | Fixture/repositório de prova controlado pelo Morrow; Enova e outros targets ficam proibidos. |
| `Q-15` | Acceptance | notification | Qual canal externo específico fecha AC-12? | Precisa de prova fora do PC | route decision | `ROUTE_DECISION` | P6-PR02 escolhe e prova ao menos um canal autenticado; custo/termos novos exigem dono. |
| `Q-16` | Reviewer | scope | Deploy de produção faz parte do mínimo? | Write em repo não implica deploy | target model | `RESOLVED` | Não; PR/candidato é o limite do MVO. |
| `Q-17` | Test Designer | recovery | Restart pode repetir efeito? | Risco de corrupção/duplicação | checkpoint/event docs | `RESOLVED` | Não; idempotência/replay são critérios obrigatórios P2/P4/P7. |
| `Q-18` | Contract Engineer | continuity | Como outra aba sabe o próximo passo? | Pedido explícito do dono | owner | `RESOLVED` | Protocolo do pacote + LIVE_STATUS + PRS + validador P0-PR03. |
| `Q-19` | Owner | intake | O operador precisa entregar um contrato pronto? | Usuário-alvo não é desenvolvedor | visão original + owner | `RESOLVED` | Não. Ele informa o objetivo, responde ao Cérebro e aprova o contrato legível antes de qualquer write. |
| `Q-20` | Architect | extensibility | Novos especialistas/connectors exigem reescrever o kernel? | Evita obsolescência e catálogo rígido | roles/skills/connectors | `RESOLVED` | Não. Papéis, skills e connectors são extensões separadas, governadas por capabilities; implementações reais adicionais ficam em contratos próprios. |
| `Q-21` | Architect | topology | O produto mínimo roda local ou em nuvem? | Define o que realmente opera na Fase 8 | owner + deployment topology | `RESOLVED` | Local-first no MVO, com arquitetura híbrida preservada; cloud worker/control plane é dívida posterior. |
| `Q-22` | Security Reviewer | privacy | O que pode permanecer no core público? | Contratos, memória e credenciais podem ser proprietários | owner + target/access docs | `RESOLVED` | Protocolos e kernel podem ser públicos; control data, targets, contratos privados, memória proprietária e credenciais ficam fora do core público. |
| `Q-23` | Security Reviewer | authority | Um comando vindo do chat/UI pode ser aceito apenas porque “parece” ser do dono? | Chat e notificação controlam writes/processos | review P0-PR02 | `RESOLVED` | Não. Toda mutação exige identidade, autorização, correlação, idempotência e anti-replay mecânicos; AC-28. |
| `Q-24` | Acceptance | usability | O operador terá de usar Git/PowerShell diariamente para controlar o Morrow? | Contraria o usuário-alvo não desenvolvedor | review P0-PR02 + owner | `RESOLVED` | Não após instalação; operação normal ocorre na interface. Terminais são observáveis/interativos, mas não pré-requisito de controle; AC-29. |

## Pass 1 — declarações independentes requeridas

`P0-PR02` anexou uma linha por papel abaixo, sem reutilizar a resposta de outro papel:

| papel | superfícies obrigatórias | resultado |
|---|---|---|
| Contract Engineer | destino, aceitação, exclusões, decisões do dono, linguagem observável | `GREEN` — destino mínimo e fronteira futura explícitos |
| Architect | fronteiras control plane/Worker/UI/gateway/Nexus, dependências e substituibilidade | `GREEN` — ADRs de rota permanecem nos PRs corretos |
| Test Designer | contraprovas, restart, concorrência, isolamento, off-PC e aceite fora do harness | `GREEN` — AC-28/29 fecharam autoridade e operação não técnica |
| Security Reviewer | shell/ConPTY, rede, identidade, replay, secrets, target escape e logs | `GREEN` — autorização de comandos e exceção bootstrap registradas |
| Reviewer | coerência interna, duplicação, lacunas e regressões da base | `GREEN` — IDs, links, dependências e baseline reconciliados |
| Acceptance | se o estado-alvo pode ser observado por operador não desenvolvedor | `GREEN` — objetivo→contrato→operação diária via UI mensurável |

## Pass 2 — adversarial

Depois de incorporar o Pass 1, os mesmos papéis responderam:

1. Qual requisito conversado não possui AC e PR?
2. Qual PR pode “ficar verde” sem entregar o estado do usuário?
3. Onde uma decisão técnica ainda poderia trocar o destino?
4. Qual segredo, target ou terminal do operador ainda poderia escapar das cercas?
5. Qual estado de restart/offline/duplicação ainda não é mensurável?
6. O que impediria outra aba de descobrir o próximo passo sem contexto conversacional?

Qualquer resposta material reabre CONTRACT/MAP/TRACEABILITY antes do primeiro write de P2.

Resultado e contraprovas: [`reviews/P0-PR02.md`](reviews/P0-PR02.md).
