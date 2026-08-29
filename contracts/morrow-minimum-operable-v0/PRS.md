# Plano de PRs — MORROW-MVO-001

Os IDs abaixo são unidades contratuais, não números antecipados do GitHub. Cada PR real registra URL/número/SHAs em `EVIDENCE.md`.

## Regras de tamanho e fechamento

- uma PR possui um objetivo observável principal;
- mudança não necessária ao objetivo vira débito;
- toda PR inclui testes/evidência proporcionais e atualização do estado contratual afetado;
- PR que toca shell, processo, rede, credencial, transcript ou autorização exige Security Review;
- PR que muda superfície aceita invalida/reexecuta evidência correspondente;
- `mergeado` não significa `PROVEN` sem gate/evidência;
- branch sugerida: `mvo/p<fase>-pr<numero>-<slug>`;
- base de integração: `phase-2/runtime-v0` até CONTRACT_CLOSE.

## Estados

`HISTORICAL_BASELINE | READY_FOR_OWNER_REVIEW | BLOCKED | PENDING | READY | RUNNING | PROVEN | REJECTED | SUPERSEDED`

## P0 — Contrato e controle de execução

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P0-PR01` | `PROVEN` | baseline `ff0359c` | Criar pacote mestre, traceability, plano de PRs, estado vivo e protocolo entre abas | commit `4bcedb9`; links/estrutura/25 testes verdes; dono revisou |
| `P0-PR02` | `PROVEN` | P0-PR01 + owner review | Executar rodada independente/adversarial, incorporar correções autorizadas e registrar contrato v1 aprovado | QUESTIONS sem bloqueio, owner approval e review em `reviews/P0-PR02.md`; CONTRACT_PREFLIGHT `READY_FOR_EXECUTION` |
| `P0-PR03` | `PROVEN` | P0-PR02 | Implementar validador/reconciliador que informa próximo passo a partir do pacote e Git | durante a execução autorizou P0-PR03; após o fechamento retorna P2-PR01 e bloqueia divergências; suíte verde |

## P1 — Fundação processual já provada

| PR-ID | status | evidência histórica | objetivo preservado | gate de regressão |
|---|---|---|---|---|
| `P1-PR01` | `HISTORICAL_BASELINE` | `f44aace..24398de` | Kernel mínimo: eventos, estado, PRE_DISPATCH, rota e adapter processual | testes do kernel/runtime permanecem verdes |
| `P1-PR02` | `HISTORICAL_BASELINE` | `ff9e2c2..9e2c083` | Locks, checkpoints, worktrees e cercas de workspace | testes de infraestrutura/segurança permanecem verdes |
| `P1-PR03` | `HISTORICAL_BASELINE` | `922e931..3931ce1` | Codex quota-session e shim Windows seguro sem fallback API | testes/probes do adapter permanecem verdes |
| `P1-PR04` | `HISTORICAL_BASELINE` | `b04dc4f`, `e4a2805`, `ff0359c` | Execução observável e sessões process-backed isoladas/múltiplas | 25 testes e critérios processuais de OPERATOR_EXPERIENCE |

## P2 — Morrow Local Worker

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P2-PR01` | `PROVEN` | P0-PR03, P1 | Definir protocolo Worker/control plane: identidade, capabilities, heartbeat, dispatch, ack, cancel e versões | PR #5; ADR/schema/decoder; 48 testes; review de arquitetura e segurança GREEN |
| `P2-PR02` | `PROVEN` | P2-PR01 integrado | Implementar serviço Local Worker configurável com managed roots e ciclo start/stop/status | PR #6; host reiniciável, diagnóstico, raiz protegida contra junction e 56 testes; review de segurança GREEN |
| `P2-PR03` | `PROVEN` | P2-PR02 integrado | Implementar registries/resolvers mínimos de Target, Role, Skill e Capability mais Secret Broker boundary | PR #7; registries/resolver estritos, boundary opaco, relógio confiável e 73 testes; review de segurança GREEN |
| `P2-PR04` | `PROVEN` | P2-PR03 integrado | Implementar Routing/Access/Model registry, Quota Guard e Budget Guard mínimos | PR #8; configuração efetiva auditável, reservas quota/budget, hardening remoto e 96 testes; review de segurança GREEN |
| `P2-PR05` | `PROVEN` | P2-PR04 | Ligar dispatch autenticado a locks/workspaces/guards e suportar PowerShell direto ou AgentInstance | PR #9; dispatch autenticado e governado, PowerShell sem LLM, AgentInstance isolada, hardening remoto e 109 testes; review de segurança GREEN |
| `P2-PR06` | `RUNNING` | P2-PR05 | Implementar reconnect, retry idempotente, fila, checkpoint e estado online/offline | base `9b96a8b`; kill/restart não duplica efeito; pendência retoma ou bloqueia com causa explícita |

## P3 — Terminal real Windows

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P3-PR01` | `PENDING` | P2-PR01/02 | Fazer spike/ADR de PTY/ConPTY e criar interface de backend com capability gate | decisão state-of-art, backend process-pipes preservado e UI impedida de chamá-lo de terminal completo |
| `P3-PR02` | `PENDING` | P3-PR01, P2-PR02 | Implementar backend ConPTY com input, resize, sinais, UTF-8 e exit status | teste/fixture interativo real no Windows |
| `P3-PR03` | `PENDING` | P3-PR02, P1-PR03 | Executar Codex quota-session pelo terminal gerenciado sem extrair credencial/API | sessão autenticada, stream ao vivo, cwd isolado e metadata do runtime |
| `P3-PR04` | `PENDING` | P3-PR03 | Provar multiplexing, cleanup, timeout/cancel e colisões sob múltiplas sessões | soak concorrente sem processo órfão, workspace compartilhado ou perda de identidade |

## P4 — Observabilidade durável

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P4-PR01` | `PENDING` | P2-PR06, P3-PR02 | Definir eventos canônicos e projector do Live Activity Feed | schema versionado e estados mecânicos reconstruíveis |
| `P4-PR02` | `PENDING` | P4-PR01 | Implementar Stream Redactor, política de retenção e transcript persistente | suíte injeta segredos e prova ausência antes de storage/UI |
| `P4-PR03` | `PENDING` | P4-PR02 | Implementar replay/reidratação, cursores e liveness após restart | cliente retoma sem duplicar/perder eventos e distingue esperas/falhas |
| `P4-PR04` | `PENDING` | P4-PR03, P3-PR04 | Expor stream/API de múltiplas sessões e provar observabilidade ponta a ponta do Worker | duas sessões reais vistas ao vivo e reidratadas após restart |

## P5 — Interface, Cérebro e reunião

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P5-PR01` | `PENDING` | P4-PR01 | State-of-art/ADR da interface e shell executável mínimo | stack escolhida por evidência, contrato de API e skeleton local iniciado |
| `P5-PR02` | `PENDING` | P5-PR01, P4-PR04 | Implementar dashboard de contrato e Live Activity Feed | UI mostra estado/eventos reais, filtros e causa de espera |
| `P5-PR03` | `PENDING` | P5-PR02, P3-PR04 | Implementar panes/tabs de terminal com seleção simultânea de agentes | render ConPTY, input endereçado, resize e identidade visível |
| `P5-PR04` | `PENDING` | P5-PR02 | Implementar chat separado Operador ↔ Cérebro para objetivo, perguntas, explicações e comandos governados | conversa não escreve em stdin; objetivo e respostas alimentam contrato; mutações exigem identidade/autorização e viram eventos |
| `P5-PR05` | `PENDING` | P5-PR04 | Implementar sala de reunião observável e participação do operador | pergunta, participantes, evidências, decisão e rota persistem/reidratam |
| `P5-PR06` | `PENDING` | P5-PR03/04/05 | Implementar pause/cancel e controles manuais de access/runtime/model/effort | effective config visível; override auditado; downgrade silencioso impossível |

## P6 — Notificações e Nexus opcional

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P6-PR01` | `PENDING` | P5-PR04, P4-PR03 | Implementar Notification Gateway, políticas, payload mínimo, dedupe e delivery receipt | eventos elegíveis geram notificação idempotente sem segredo/código bruto nem autoridade implícita |
| `P6-PR02` | `PENDING` | P6-PR01 | Entregar pelo menos um canal autenticado acessível fora do PC | dispositivo externo recebe alerta de decisão/erro/conclusão e confirma entrega |
| `P6-PR03` | `PENDING` | P6-PR02 | Fazer resposta externa virar owner decision autenticada e retomar fluxo | roundtrip completo com correlação, expiração e proteção contra replay |
| `P6-PR04` | `PENDING` | P6-PR01, P2-PR01 | Criar connector Nexus opcional para delegar contrato e/ou transportar alerta | Morrow opera com connector desligado; Nexus não acessa terminal/workspace diretamente |
| `P6-PR05` | `PENDING` | P6-PR03, P2-PR06 | Exibir/avisar Worker offline e governar fila/retomada | PC offline não simula execução; retorno do Worker acorda somente trabalho válido |

## P7 — Execução completa de contrato

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P7-PR01` | `PENDING` | P0-PR03, P4, P5 | Integrar objetivo em linguagem comum, question round, geração/aprovação de contrato, mapa, live memory, gates e estado | operador não técnico aprova contrato legível; fixture válida entra; contrato não aprovado/bloqueado é recusado; estado é retomável |
| `P7-PR02` | `PENDING` | P7-PR01, P3-PR03 | Implementar loop Cérebro/Orchestrator → dispatch multi-role → retorno adaptativo | Executor/Reviewer/Diagnostician podem voltar/reunir sem mudar destino |
| `P7-PR03` | `PENDING` | P7-PR02, P4-PR03 | Implementar Regression Resolver/inheritance, invalidação de evidência, dívida filha e Artifact Store contratual | mudança reabre prova afetada; execução filha herda critérios; achado lateral não vira escopo |
| `P7-PR04` | `PENDING` | P7-PR03 | Integrar target Git: branch/workspace/checks/candidate/PR | protected base intacta; PR reproduzível contém evidência e metadados do contrato |
| `P7-PR05` | `PENDING` | P7-PR03 | Implementar retrospectiva independente, reunião coletiva, Supervisor e candidatos de aprendizado | candidato segue observação→validação e nunca é promovido pelo agente que o propôs |
| `P7-PR06` | `PENDING` | P7-PR04/05, P6 | Provar cenário mestre: objetivo, contrato aprovado, dois agentes, reunião, decisão fora do PC, restart, review e PR | transcript/eventos/evidências cobrem AC-02..AC-22 e AC-25..AC-27 aplicáveis |
| `P7-PR07` | `PENDING` | P7-PR06 | Atacar isolamento, auth, replay, segredo, quota, cancel, regressão/inheritance e aprendizado | Security Reviewer/Auditor não encontram bloqueio aberto; contraprovas registradas |

## P8 — Operação e fechamento

| PR-ID | status | dependências | objetivo único | saída/prova de conclusão |
|---|---|---|---|---|
| `P8-PR01` | `PENDING` | P7-PR07 | Entregar bootstrap/instalação, autostart opcional, atualização, backup e diagnóstico | operador instala/inicia/para/diagnostica sem editar fonte; rollback testado |
| `P8-PR02` | `PENDING` | P8-PR01 | Executar Acceptance limpa em Windows fora do harness de desenvolvimento | AC-01..AC-23 e AC-25..AC-29 medidos com evidência visual/terminal/eventos/PR |
| `P8-PR03` | `PENDING` | P8-PR02 | Realizar review/audit finais, retrospectiva, métricas, triagem e CONTRACT_CLOSE | AC-24..AC-29, snapshot final, release/tag MVO e owner acceptance |

## Critério de “Morrow já opera”

Somente `P8-PR03: PROVEN` autoriza declarar o Morrow operacional. Antes disso, existem capacidades reais, mas o produto mínimo ainda não foi aceito como conjunto.
