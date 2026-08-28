# Contrato mestre — Morrow Minimum Operable V0

## Identidade

- `contract_id`: `MORROW-MVO-001`
- `contract_version`: `1.0`
- `owner`: Bruno Vasque
- `created_at`: `2026-08-28`
- `status`: `READY_FOR_EXECUTION`
- `parent_contract_id`: `none`
- `target_id`: `morrow-core`
- `execution_branch`: `phase-2/runtime-v0`

## 1. Objetivo mestre

Entregar o **Morrow Mínimo Operável**: um sistema local-first, governado por contratos, no qual um operador não desenvolvedor descreve um objetivo em linguagem comum, responde às dúvidas do Cérebro, aprova o contrato resultante e então acompanha o Morrow planejar e despachar papéis, executar agentes e trabalhos PowerShell em workspaces isolados, exibir os terminais reais dos agentes ao vivo numa interface própria, manter chat separado com o Cérebro, realizar sala de reunião, solicitar decisão do operador fora do PC, retomar após interrupção e produzir um candidato/PR auditável sem tocar em nenhum alvo não autorizado.

O objetivo não é concluir todas as possibilidades futuras do Morrow. A Fase 8 fecha a primeira versão capaz de operar dentro do envelope definido neste contrato. Expansões posteriores exigem novo contrato ou execução filha.

### 1.1 Visão de longo prazo preservada

O destino maior continua sendo uma empresa de software governada por agentes que transforma necessidade humana em software entregue. O core deve permanecer independente de modelo, repositório e fornecedor; papéis e skills especializadas são extensíveis; connectors expõem capacidades mínimas para serviços como GitHub, Vercel, Cloudflare e Supabase; dados reais de clientes, targets e credenciais permanecem privados; e a topologia pode evoluir de local-first para híbrida/cloud.

Este contrato não promete fechar todo esse destino. Ele prova o primeiro recorte operacional completo para um operador, Windows, um Worker local, Codex por cota, target Git controlado e entrega até candidato/PR. Catálogos amplos de especialistas, connectors reais adicionais, cloud workers, SaaS, cobrança e produção pertencem a contratos posteriores já registrados em `DEBTS.md`.

## 2. Dor atual / estado atual

O repositório já prova kernel mínimo, eventos, estado vivo, PRE_DISPATCH, loops de rota, locks, checkpoints, worktrees, adapter Codex quota-session e sessões processuais observáveis com concorrência e isolamento.

Ainda não existe um produto operável ponta a ponta. Faltam:

- Local Worker como serviço governado e recuperável;
- terminal PTY/ConPTY verdadeiro;
- observabilidade persistente, redaction e replay;
- Cérebro/Orchestrator conectado ao runtime completo;
- interface do operador com terminais, chat e reunião separados;
- notificação e resposta quando o operador estiver longe;
- delegação opcional pelo Nexus sem torná-lo autoridade de execução;
- instalação, diagnóstico, segurança e Acceptance fora do harness de testes;
- um mapa mestre que permita retomar o trabalho em qualquer aba sem depender da conversa.

## 3. Estado-alvo observável

Em uma máquina Windows suportada e ligada, o operador abre o Morrow, descreve um objetivo ou retoma um contrato ativo. Para um objetivo novo, o Cérebro conduz a rodada de dúvidas, apresenta destino, escopo, critérios e exclusões em linguagem compreensível e aguarda aprovação explícita. Só então cria a rota e despacha pelo menos Executor e Reviewer em instâncias distintas. O Local Worker cria workspaces separados, inicia terminais ConPTY reais e transmite atividade ao vivo. O operador continua livre para usar seus próprios PowerShells e outros projetos.

Durante a execução, uma dúvida abre reunião governada. Se depender do dono, o Morrow registra `OWNER_DECISION_REQUIRED`, envia notificação autenticada fora do PC, recebe a resposta pelo canal do Cérebro, registra a decisão e retoma. Após restart do control plane ou Worker, o contrato é reidratado. Ao final, o Morrow produz candidato/PR e só fecha após regressão, review, audit/acceptance aplicáveis e evidência reproduzível.

## 4. Envelope mínimo de operação

O MVO é considerado operacional somente dentro deste envelope:

- um operador autenticado;
- primeira plataforma de Acceptance: Windows com PowerShell e ConPTY;
- um control plane e pelo menos um `local-worker`;
- repositórios Git explicitamente registrados como targets;
- modo de escrita `branch-only` ou `pr-only`;
- Codex quota-session como primeiro runtime de agente real;
- PowerShell determinístico permitido sem LLM quando o trabalho não exigir julgamento;
- múltiplas AgentInstances simultâneas, limitadas por locks/cota/política;
- interface local do Morrow e pelo menos um canal autenticado de notificação fora do PC;
- Nexus como conector opcional de delegação/notificação, nunca como executor obrigatório;
- nenhuma implantação de produção implícita.

## 5. Critérios de aceitação / encerramento

| id | critério observável |
|---|---|
| `AC-01` | Instalação documentada inicia, para e diagnostica control plane e Local Worker em Windows sem editar código-fonte. |
| `AC-02` | Um contrato inválido/bloqueado é recusado antes de qualquer write; um contrato válido produz mapa, estado vivo e PRE_DISPATCH verificável. |
| `AC-03` | O estado do contrato é reconstruído após restart a partir de eventos, checkpoints e artefatos, sem depender da conversa anterior. |
| `AC-04` | O Local Worker executa um trabalho PowerShell determinístico autorizado sem exigir AgentInstance/LLM e registra início, saída, fim e workspace. |
| `AC-05` | O Cérebro/Orchestrator despacha pelo menos Executor e Reviewer como AgentInstances distintas, com contexto e responsabilidades separados. |
| `AC-06` | Cada agente que toca target recebe workspace próprio e terminal real PTY/ConPTY, com identidade, cwd, PID, runtime e ciclo de vida visíveis. |
| `AC-07` | A interface mostra saída incremental real antes do término, sem fabricar atividade a partir de resumo do Cérebro. |
| `AC-08` | Duas ou mais sessões rodam simultaneamente em workspaces distintos; colisão de workspace/identidade é recusada mecanicamente. |
| `AC-09` | Terminais, projetos e diretórios abertos manualmente pelo operador permanecem fora do ciclo de vida do Morrow. |
| `AC-10` | Chat Operador ↔ Cérebro é canal próprio e não se confunde com stdin ou transcript de terminal. |
| `AC-11` | Sala de reunião exibe pergunta, participantes, evidências, decisão, efeito na rota e registro canônico; o operador pode participar. |
| `AC-12` | `OWNER_DECISION_REQUIRED` gera notificação autenticada fora do PC, aceita resposta e retoma somente após registrar autoridade/evidência. |
| `AC-13` | Worker offline/suspenso aparece como indisponível; execução local é enfileirada/bloqueada e retoma de forma governada quando voltar. |
| `AC-14` | Codex quota-session executa sem API key e nunca cai para API sem autorização e budget explícitos. |
| `AC-15` | Operador consegue ver e alterar manualmente modo de acesso, runtime/modelo/effort e pause/cancel dentro das permissões; toda mudança vira evento. |
| `AC-16` | Segredos e entradas sensíveis são redigidos antes de stream persistido/exibido; políticas de retenção e acesso são verificadas. |
| `AC-17` | Nenhum processo escreve fora de target/workspace autorizado; Enova e qualquer outro target externo não registrado permanecem intocados. |
| `AC-18` | Mudança de código nasce em branch/workspace do contrato, passa checks e produz PR/candidato; protected base não recebe write direto. |
| `AC-19` | Reviewer e Auditor/Acceptance aplicável executam independentemente do Executor e invalidam evidência afetada por mudanças posteriores. |
| `AC-20` | Pause, cancel, timeout, falha de processo e perda/reconexão do Worker produzem estados distintos, eventos e recuperação previsível. |
| `AC-21` | Live Activity Feed distingue ao menos: dispatch, gate, tool/process, waiting-lock, waiting-quota, waiting-owner, blocked, failed e done. |
| `AC-22` | Um cenário ponta a ponta demonstra contrato → dois agentes → reunião → decisão externa → retomada → review → candidato/PR → fechamento. |
| `AC-23` | Testes de regressão, segurança, restart e isolamento passam no Windows fora do harness puramente simulado. |
| `AC-24` | CONTRACT_CLOSE registra Acceptance, commits/PRs, métricas, débitos, retrospectiva, snapshot final e tag/release do MVO. |
| `AC-25` | Antes de dispatch, o kernel resolve e prova target, role, skills, capabilities, secret policy, routing/access/model/effort, quota e budget; ausência/incompatibilidade bloqueia mecanicamente. |
| `AC-26` | Regressão/inheritance, achados/débitos, retrospectiva, Supervisor e candidatos de aprendizado funcionam sem promoção automática nem regressão de contrato-pai. |
| `AC-27` | Pela interface/chat, um operador não desenvolvedor informa um objetivo, recebe perguntas necessárias e um contrato legível com escopo, critérios e exclusões; nenhum write ocorre antes da aprovação explícita desse contrato. |
| `AC-28` | Toda ação mutável recebida pela interface, chat, reunião ou canal externo possui identidade, autorização, correlação, idempotência e proteção contra replay; comando sem essas provas é recusado. |
| `AC-29` | Depois da instalação guiada, o uso diário — iniciar/retomar contrato, observar, responder, pausar e cancelar — acontece pela interface do Morrow sem exigir que o operador use Git ou PowerShell manualmente. |

## 6. Exclusões explícitas

Não pertencem ao destino deste contrato:

- alta disponibilidade, cluster ou multi-tenant;
- múltiplos operadores/organizações;
- suporte obrigatório a macOS/Linux no MVO;
- aplicativo móvel nativo;
- execução quando o computador local estiver desligado ou suspenso;
- deploy autônomo de produção;
- suporte completo a todos os providers/modelos;
- routing totalmente automático sem amostra/limite aprovado;
- edição de Enova ou de qualquer repositório externo como parte da construção do Morrow;
- transformar Nexus em dependência, memória canônica ou autoridade de execução;
- afirmar compatibilidade de terminal real usando apenas pipes;
- resolver todos os débitos e expansões futuras do produto.

## 7. Restrições e invariantes que não podem regredir

1. Contrato define destino; mapa define rota; memória viva define posição atual.
2. Mudança de destino exige adendo aprovado; mudança de rota exige registro no mapa.
3. Nenhum write antes de CONTRACT_PREFLIGHT/PRE_DISPATCH aplicáveis.
4. Papel, modelo, sessão, workspace e target permanecem dimensões separadas.
5. Workspace e terminal do operador nunca são apropriados implicitamente.
6. Cada workspace de escrita ativo possui um único dono/lock compatível.
7. Quota-session é primeira classe; API não é requisito nem fallback silencioso.
8. Segredos não entram em prompts, logs, transcripts, Git ou memória pública sem política explícita.
9. Eventos mecânicos são fonte de verdade; narrativa de agente é explicação, não prova.
10. Reviewer/Auditor preservam independência e não herdam raciocínio privado do Executor.
11. Evidência fica `STALE` quando superfície coberta muda.
12. Achado lateral vira débito; não vira melhoria oportunista.
13. Local Worker aceita somente dispatch autenticado, capability autorizada e target registrado.
14. Conexão remota do Worker é outbound e não exige abrir porta de entrada por padrão.
15. Headless silencioso não é default no worker pessoal.
16. Protected branch e deploy exigem capacidades separadas.
17. Falha num workspace não corrompe control plane, outro contrato, outro target ou terminal do operador.
18. Nenhuma aba/sessão pode escolher o próximo trabalho ignorando `LIVE_STATUS.md` e dependências do mapa.
19. Mecânica governa cercas, autoridade e prova; a rota de raciocínio pode voltar a diagnóstico, reunião, execução, revisão ou auditoria sempre que necessário sem mudar silenciosamente o destino.
20. Skill fornece especialização e connector fornece capacidade; nenhum deles assume a governança do kernel.
21. Decisão técnica com dependência relevante ou risco de obsolescência exige medição do estado da arte e ADR antes da implementação irreversível.

## 8. Riscos principais

| risco | tratamento obrigatório |
|---|---|
| ConPTY/dependência nativa instável | spike + ADR + fallback rotulado `process-pipes`; não prometer terminal completo sem prova real |
| Vazamento de segredo no stream | Stream Redactor antes de persistência/exibição + testes adversariais |
| Worker receber poder excessivo | capability allowlist, target registry, managed roots, assinatura/autenticação e Security Review |
| Cota consumida por paralelismo | Quota Guard, limites por runtime e visibilidade de espera/reserva |
| UI parecer ativa com agente parado | eventos mecânicos e liveness explícito |
| Restart repetir efeitos | idempotência, checkpoints, causation/correlation IDs e replay testado |
| Notificação externa virar autoridade | resposta autenticada entra pelo Decision Gateway e é validada pelo kernel |
| Nexus criar acoplamento | adapter opcional com contrato estreito; Morrow continua operando sem Nexus |
| Planejamento ficar desatualizado | cada PR atualiza status/evidência; reconciliador bloqueia divergência |
| Escopo crescer indefinidamente | exclusões, débitos, PRs pequenos e CONTRACT_CLOSE do envelope mínimo |

## 9. Entregáveis

1. pacote contratual e protocolo de retomada;
2. validador/reconciliador de contrato, mapa, PRs e estado vivo;
3. Local Worker governado;
4. backend Windows ConPTY e multiplexer de sessões;
5. observabilidade persistente, redaction, replay e liveness;
6. Cérebro/Orchestrator e execução de papéis conectados ao kernel;
7. interface com dashboard, terminais, chat, reunião e controles;
8. Notification Gateway e canal externo autenticado;
9. connector Nexus opcional;
10. fluxo Git candidato/PR e gates de review/audit/acceptance;
11. instalador/bootstrap, diagnóstico, backup/recuperação e runbooks;
12. registries/guards mínimos de target, role, skill, capability, secret, routing, quota e budget;
13. regressão/inheritance, debt flow, retrospectiva, Supervisor e candidatos de aprendizado;
14. prova ponta a ponta, evidências, métricas e release MVO.

## 10. Decisões do dono já resolvidas

| id | decisão |
|---|---|
| `OD-01` | A experiência principal é observar agentes trabalhando em terminais próprios dentro da interface do Morrow. |
| `OD-02` | Terminais/projetos do operador rodam em paralelo e separados dos agentes. |
| `OD-03` | Chat com o Cérebro e sala de reunião são superfícies separadas dos terminais. |
| `OD-04` | A arquitetura preferida é Cérebro/control plane + Morrow Local Worker; o Worker não precisa ser outro Cérebro. |
| `OD-05` | Trabalho PowerShell determinístico pode rodar no Worker sem LLM; trabalho semântico usa AgentInstance. |
| `OD-06` | Nexus pode delegar/notificar, mas não é dependência nem autoridade de execução do Morrow. |
| `OD-07` | Morrow terá Notification Gateway próprio para avisar decisões quando o operador estiver fora do PC. |
| `OD-08` | Se o PC estiver offline/suspenso, trabalho local espera; não se finge execução. |
| `OD-09` | O primeiro aceite operacional é Windows/PowerShell/ConPTY, preservando arquitetura portável. |
| `OD-10` | O objetivo deste contrato é funcionamento mínimo real, não todas as expansões futuras. |
| `OD-11` | Planejamento, PRs, estado e próximo passo devem ficar canônicos no repositório para retomada entre abas. |
| `OD-12` | Enova e outros targets externos ficam fora deste contrato. |
| `OD-13` | A experiência mínima começa com objetivo em linguagem comum, rodada de dúvidas e aprovação do contrato; o operador não precisa escrever arquivos contratuais manualmente. |
| `OD-14` | Papel, skill, modelo, sessão, workspace e target são dimensões separadas; novos especialistas entram sem reescrever o kernel. |
| `OD-15` | Connectors expõem capabilities mínimas e separadas; acesso a repo não concede DNS, banco ou produção. |
| `OD-16` | O core pode ser público, mas credenciais, targets, contratos e memória proprietária permanecem em control data privado/local. |
| `OD-17` | O MVO é local-first e deve preservar uma evolução híbrida; cloud/SaaS não são requisito deste fechamento. |
| `OD-18` | O Morrow deve pesquisar e medir soluções atuais antes de fixar tecnologia relevante, preservando substituibilidade. |

## 11. Decisões ainda abertas

Nenhuma decisão de destino do dono está aberta neste draft. Escolha de framework UI, biblioteca ConPTY e primeiro canal externo são decisões técnicas de rota sujeitas a ADR/state-of-art, desde que cumpram os critérios deste contrato. Custo, nova credencial externa ou mudança de comportamento contratado reabre decisão do dono.

## 12. Preflight status

- discovery complete: `yes`
- diagnostic evidence complete: `yes`
- multi-role question round complete: `yes`
- blocking questions open: `0`
- execution map reviewed: `yes`
- regression baseline identified: `yes`
- state-of-art scan required: `yes`
- state-of-art scan complete: `deferred per route to P3-PR01/P5-PR01/P6-PR02`
- ready for execution beyond planning: `yes, after P0-PR03 installs the mechanical reconciler`

O dono aprovou a continuidade em 2026-08-28. O passe multi-role e adversarial de `P0-PR02` está registrado em [`reviews/P0-PR02.md`](reviews/P0-PR02.md). O primeiro write de implementação permanece bloqueado somente até `P0-PR03` instalar e provar o reconciliador mecânico.
