# Mapa de execução — MORROW-MVO-001

O contrato declara o destino. Este mapa declara a rota inicial. A rota pode voltar, repetir ou mudar com evidência registrada; o destino não muda sem adendo aprovado.

## Sequência macro

```text
P0 Contrato e controle de execução
       ↓
P1 Fundação processual (baseline já provado)
       ↓
P2 Local Worker
       ↓
P3 Terminal ConPTY real
       ↓
P4 Observabilidade durável
       ↓
P5 Interface + Cérebro + reunião
       ↓
P6 Notificações + Nexus opcional
       ↓
P7 Contrato ponta a ponta
       ↓
P8 Operação, Acceptance e fechamento MVO
```

P1 já existe como baseline, mas permanece no mapa para preservar proveniência e regressão. Após P0 fechar preflight, a rota executável normal começa em P2.

## Fases

| fase | objetivo | por que existe | PRs | papéis principais | entradas | saídas | pré-requisitos | superfície de regressão | evidência exigida | gate de conclusão |
|---|---|---|---|---|---|---|---|---|---|---|
| `P0` | Congelar destino, rastreabilidade, PRs e retomada determinística | Impedir execução “de cabeça” e desvio entre abas | `P0-PR01..03` | Contract Engineer, Architect, Test Designer, Security Reviewer, Acceptance, Orchestrator, Owner | documentação canônica + baseline `ff0359c` | pacote aprovado + validador + `READY_FOR_EXECUTION` | owner review e passes independentes | contratos, gates, branch e status | validação estrutural, perguntas resolvidas, decisão do dono | CONTRACT_PREFLIGHT |
| `P1` | Preservar kernel/process/runtime baseline já aceito | Evitar reconstruir ou regredir fundação existente | `P1-PR01..04` | Executor, Reviewer, Auditor | commits históricos + testes | baseline reprodutível de 25 testes | já provado | event log, state, predispatch, workspace, quota adapter, terminal processual | `npm test`, commits e docs | `PROVEN_BASELINE` |
| `P2` | Criar Local Worker governado, guards/registries mínimos e recovery | PowerShell/CLIs/workspaces locais precisam de autoridade mecânica própria | `P2-PR01..06` | Architect, Executor, Security Reviewer, Reviewer | contrato + baseline P1 | protocolo, serviço, registries, guards, dispatch, heartbeat, recovery | P0 e P1 | processo, filesystem, auth, target, skill, capability, secrets, routing, quota, budget, locks, checkpoint | testes de serviço/recusa/restart/offline e Security Review | Worker inicia, anuncia capabilities e executa somente dispatch completamente autorizado |
| `P3` | Entregar terminal Windows PTY/ConPTY verdadeiro | Pipes não cumprem a experiência final prometida | `P3-PR01..04` | Architect, Experimenter, Executor, Security Reviewer, Acceptance | Worker P2 + terminal processual P1 | backend ConPTY, multiplexing e Codex CLI integrado | P2 | terminal, sinais, UTF-8, input, resize, cleanup, quota | prova interativa real + testes de isolamento/soak | AC-06, AC-08, AC-14 e AC-20 aplicáveis |
| `P4` | Tornar atividade observável, segura e reidratável | Terminal vivo sem evento/replay não sustenta confiança nem retomada | `P4-PR01..04` | Architect, Executor, Test Designer, Security Reviewer, Auditor | P2/P3 + Event Log | schema, projector, redaction, transcript, replay, liveness/API stream | P3 | eventos, segredos, storage, restart, ordenação | testes adversariais, replay e duas sessões; para P4-PR02, revisão local independente somente-leitura conforme `A-001` | AC-03, AC-07, AC-16, AC-20, AC-21 |
| `P5` | Entregar interface do operador, Cérebro e reunião | O produto precisa ser operado sem depender do terminal/manual técnico | `P5-PR01..06` | Discovery, Architect, Executor, Reviewer, Security Reviewer, Acceptance | APIs P2-P4 + governança | dashboard, panes, chat, meeting room e controles | P4 | UX, identidade, autoridade, comandos, terminal rendering, meeting | Acceptance visual/funcional, autorização e acessibilidade básica | AC-05, AC-07, AC-10, AC-11, AC-15, AC-28, AC-29 |
| `P6` | Avisar e receber decisão fora do PC; integrar Nexus opcionalmente | Autonomia para quando o operador não está diante da máquina | `P6-PR01..05` | Architect, Security Reviewer, Executor, Reviewer, Acceptance | eventos/decisões P4-P5 + Worker | gateway, canal externo, resposta autenticada, Nexus adapter, offline semantics | P5 | rede, identidade, replay, duplicação, custo/credenciais | roundtrip externo, delivery receipt, testes offline/security | AC-12, AC-13, AC-16, AC-20 |
| `P7` | Executar um contrato real completo, incluindo regressão, dívida e aprendizado | Partes isoladas não provam funcionamento do Morrow | `P7-PR01..07` | Discovery, Contract Engineer, Orchestrator, Executor, Diagnostician, Reviewer, Auditor, Acceptance, Supervisor | P0-P6 | objetivo, question round, contrato aprovado, dispatch adaptativo, regressão/inheritance, integração Git, aprendizado, cenário E2E e suite adversarial | P6 | todos os critérios e invariantes | prova objetivo→contrato aprovado→PR com reunião/decisão/restart/debt/retrospectiva | AC-02..AC-23 e AC-25..AC-27 aplicáveis |
| `P8` | Tornar instalável, verificável e fechar o MVO | Harness verde não equivale a produto operável | `P8-PR01..03` | Integrator, Security Reviewer, Auditor, Acceptance, Supervisor, Owner | candidato P7 | bootstrap, runbooks, Acceptance Windows, auditoria, release/snapshot | P7 | instalação, atualização, recuperação, documentação, métricas | execução limpa fora do dev harness + CONTRACT_CLOSE | AC-01, AC-23..AC-29 e aprovação do dono |

## Dependências e paralelismo

- Uma PR só fica `READY` quando todas as dependências listadas em `PRS.md` estão `PROVEN`.
- Paralelismo só é permitido quando `PRS.md` o declara e os lock scopes não se sobrepõem.
- P3 pode abrir spike técnico somente depois do protocolo Worker P2-PR01; implementação ConPTY depende do host P2-PR02.
- P5 não fabrica dados: UI depende das APIs/eventos reais de P4.
- P6 não usa Nexus como atalho para evitar Notification Gateway.
- P7 não inicia sobre mock como prova final; fixtures podem preparar o cenário, mas Acceptance usa componentes reais.
- P8 não fecha com feature central marcada “TODO”, teste apenas simulado ou dívida que invalide critério do contrato.

## Rotas de retorno autorizadas

| achado | retorno mínimo |
|---|---|
| ConPTY não preserva semântica necessária | P3-PR01/02 → novo spike/ADR; processo-pipes permanece fallback rotulado, não aceite final |
| Stream vaza segredo | P4-PR02 → Security Review aplicável (`A-001` somente nesta unidade) → reexecução de toda prova afetada |
| UI não corresponde a eventos reais | P5 → P4 projector/API → P5 Acceptance novamente |
| Notificação duplica/perde decisão | P6-PR01/03 → idempotência/auth → repetir cenário P7 |
| Restart repete efeito | P2-PR06/P4-PR03 → checkpoint/replay → revalidar P7 |
| Reviewer/Auditor perde independência | P5/P7 → contexto/dispatch → repetir review/audit |
| Descoberta muda destino | parar; registrar `ADDENDA.md`; exigir owner approval |
| Descoberta é lateral | `DEBTS.md`; não implementar no contrato atual |

## Exceção de rota aprovada — A-001

Somente para P4-PR02, a indisponibilidade do Security Review externo é tratada pela seguinte rota substituta:

```text
base 3657a070e5dc6b1e7b78fa1804761440c55efffc
  → candidate inicial 79382d421a9a6e9df2956007fb701d32d00c5952
  → sessão local de Security Reviewer distinta do Executor
  → checkout somente-leitura e SHAs verificados antes da análise
  → relatório de transcript/redaction com cobertura, ferramenta, testes,
    achados, limites e veredito
  → P2 de DoS algorítmica encontrado: BLOCKED e retorno a P4-PR02
  → correção estrutural a44daee73ac6bb9b91523a947a6e0154397efcee
  → nova sessão local independente, read-only, base/head novamente fixados
  → nenhum P1/P2: gate local satisfeito, ainda sujeito a merge e regressão pós-merge
```

O relatório deve declarar expressamente que essa prova local não equivale ao serviço externo indisponível e não mede superfícies fora de transcript/redaction. Reviews anteriores, a narrativa do Executor e os testes já registrados são entrada reproduzível, não substitutos da nova revisão independente.

## Cobertura dos entregáveis

| entregável do contrato | fase(s) |
|---|---|
| pacote/retomada/validador | P0 |
| Local Worker | P2 |
| ConPTY/multiplexer | P3 |
| observabilidade/redaction/replay | P4 |
| Cérebro/interface/chat/reunião/controles | P5 |
| notificações/Nexus/offline | P6 |
| contrato→agentes→PR | P7 |
| instalação/Acceptance/release | P8 |

## Regra para escolher o próximo passo

1. Se `CONTRACT.md`/adendo tiver decisão bloqueante, o próximo passo é resolver essa decisão.
2. Se Git/Event Log divergir de `LIVE_STATUS.md`, o próximo passo é reconciliar estado, sem write de produto.
3. Caso contrário, escolha a primeira PR em `PRS.md` com status `READY`, dependências `PROVEN`, perguntas bloqueantes zero e target/base válidos.
4. Antes do dispatch, gere PRE_DISPATCH com objetivo exato daquela PR.
5. Falha de gate corrige/reabre a rota; nunca pula para a PR seguinte.
6. Ao provar a PR, atualize `EVIDENCE.md`, `PRS.md` e `LIVE_STATUS.md` antes de autorizar a próxima.

O campo `next_authorized_action` de `LIVE_STATUS.md` é a projeção humana dessa regra e nunca pode contrariá-la.
