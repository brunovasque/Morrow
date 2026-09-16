# Serviços determinísticos do kernel

Nem toda responsabilidade merece um LLM. O Morrow usa agentes para julgamento e produção; usa máquina determinística para garantias operacionais.

## Serviços do kernel

1. **State Store** — estado canônico de contrato, etapa, invocação, decisão, débito e execução filha.
2. **Event Log** — sequência append-only de despacho, ação, observação, reunião, decisão, recusa e transição.
3. **Live Memory Projector** — materializa a memória viva a partir do event log/artefatos e produz snapshots versionados para PRE_DISPATCH.
4. **Checkpoint Manager** — salva e restaura execução sem repetir trabalho concluído.
5. **Scheduler / Wake** — acorda o Orchestrator por evento ou agenda, sem interpretar conteúdo.
6. **Lock Manager** — impede duas execuções incompatíveis sobre o mesmo recurso/target.
7. **Budget Guard** — teto monetário por invocação, etapa, contrato, provider e período quando houver custo medido.
8. **Quota Guard** — controla concorrência, reserva e disponibilidade de runtimes autenticados por assinatura/cota.
9. **Routing Control Registry** — resolve overrides `manual | assisted | automatic`, access mode, runtime/modelo e effort por execução/contrato/target/global, respeitando precedência.
10. **Capability Resolver** — confere se papel/modelo/runtime possuem ferramentas e permissões exigidas.
11. **Skill Resolver** — resolve skills autorizadas a partir do plano/política; não deixa o modelo se autoautorizar.
12. **Access Router** — resolve `quota-session | api | local` conforme política; API nunca é fallback silencioso.
13. **Provider/Model Router** — escolhe adapter/modelo conforme configuração efetiva, risco, capacidade, independência, qualidade histórica, cota, custo e disponibilidade.
14. **Secret Broker** — entrega credenciais somente ao runtime/tool que precisa. Credencial/sessão de assinatura não é exportada como API key nem inserida na memória.
15. **Sandbox Manager** — cria ambiente isolado, reproduzível e descartável para execução.
16. **Target Registry** — resolve descritores de repositório/projeto-alvo, políticas e perfis sem expor credenciais ao agente.
17. **Repository Adapter** — interface estreita para fetch/read/branch/commit/PR/status; nunca concede mais poder do que o descritor do alvo permite.
18. **Workspace Manager** — cria checkout/worktree/sandbox por contrato/etapa, fixa base SHA e garante isolamento entre alvos.
19. **Terminal Session Manager / Host** — cria e gerencia sessão processual observável por `AgentInstance` no local-worker, prende seu cwd ao workspace autorizado, transmite o stream da CLI real e governa entrada/timeout/interrupção sem anexar terminais do operador.
20. **Session Multiplexer** — permite acompanhar múltiplas AgentInstances simultaneamente em panes/tabs/sessões ou equivalente, sem exigir uma sessão permanente por papel.
21. **Live Activity Feed** — projeta eventos reais do kernel em linguagem operacional legível: dispatch, gate, lock, reunião, tool/process, checkpoint, teste, review/audit, bloqueio e conclusão.
22. **Stream Redactor** — remove segredos/tokens/variáveis sensíveis antes de espelhar ou persistir streams humanos.
23. **Regression Resolver** — resolve superfícies, checks/cercas obrigatórios e verifica que foram realmente executados contra o candidato.
24. **Regression Inheritance Resolver** — em execução filha de débito, reconstrói e deduplica a anti-regressão do contrato-pai/ancestrais vigentes.
25. **Artifact Store** — guarda arquivos/saídas com hash, versão e vínculo à invocação/contrato.
26. **Retry Controller** — distingue falha transitória de volta semântica; retry técnico não vira debate de agente.
27. **Liveness Monitor** — detecta papel parado, sessão morta e mensagem não entregue e informa estado visível (`thinking`, `tool-running`, `waiting-lock`, `waiting-quota`, `blocked`, `failed`, `done`).
28. **Policy/Gate Engine** — executa `STATE_OF_ART_SCAN`, `CONTRACT_PREFLIGHT`, `PRE_DISPATCH`, `SCOPE_DRIFT_VETO`, `REGRESSION_VETO`, `DEBT_CLOSE_REGRESSION`, `LEARNING_PROMOTION`, `CONTRACT_CLOSE` e futuros gates.

## O que continua semântico

A máquina pode exigir que exista classificação/evidência; não deve inventar o significado do contrato.

Exemplos:

- o Orchestrator/Contract Engineer determinam semanticamente se um achado muda destino;
- o kernel impede a execução enquanto a classificação/autorização necessária estiver ausente;
- Reviewer/Auditor julgam cobertura/evidência;
- o kernel comprova que os checks obrigatórios foram de fato executados.

## Regra

Se a pergunta for "a máquina consegue garantir isso sem raciocínio?", a responsabilidade fica no kernel.

Verificar hash, lock, schema, budget, cota exposta, presença de campo, timeout, checkpoint, base SHA, branch permitida, target autorizado, configuração manual, execução de check, abertura/fechamento de sessão e anúncio de evento mecânico NÃO são tarefas de agente.

## Consequência

O Orchestrator decide semanticamente **o que fazer a seguir**. O kernel decide mecanicamente **se a transição é permitida, qual rota de acesso está autorizada e como executá-la com segurança**.

O Morrow pode governar repositórios externos sem existir dentro deles. O kernel mantém contrato/memória/governança; o Workspace Manager e Repository Adapter projetam somente as capacidades autorizadas sobre cada alvo.

No local-worker, execução observável é parte do runtime: o operador deve conseguir acompanhar AgentInstances ativos, reuniões, gates e mudanças de rota sem depender apenas de um JSON final. Ver `runtime/OBSERVABLE_EXECUTION.md`.
