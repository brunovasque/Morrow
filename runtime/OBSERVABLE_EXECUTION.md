# Execução observável

O Morrow não deve operar como uma caixa-preta local. No `local-worker`, a execução de agentes é **observável por padrão**.

O kernel/control plane pode usar Node.js, banco local, filas e serviços internos, mas isso não substitui a experiência operacional do agente. Quando um AgentInstance estiver ativo, o operador deve conseguir ver uma sessão viva equivalente ao terminal/CLI real do provider, com identidade, contexto operacional e atividade em tempo real.

## Princípio

**Automação não significa invisibilidade.**

A governança do Morrow deve permitir que o operador veja quem está trabalhando, em quê, por quê, em qual alvo/workspace e em qual ponto do contrato.

## Modos de visibilidade

Cada execução declara `visibility_mode`:

- `foreground` — sessão/terminal visível e acompanhável pelo operador;
- `mirrored` — processo pode rodar sob controle do runtime, mas stdout/stderr/eventos são espelhados ao vivo em terminal/painel;
- `headless` — execução sem terminal visível; somente quando configuração/política permitir.

No `local-worker` pessoal, o default inicial é **`foreground` ou `mirrored`**, nunca `headless` silencioso.

O operador pode mudar manualmente essa configuração por global/target/contrato/papel/invocação, seguindo a mesma precedência do Routing Control.

## Identidade visível de cada AgentInstance

Antes de iniciar trabalho, a sessão mostra um cabeçalho operacional com pelo menos:

```text
MORROW AGENT
Role: Executor
Instance: executor#C-0042:S3:01
Contract: C-0042
Step/objective: corrigir persistência sem regressão
Target: project-X
Workspace: .../C-0042/executor-01
Runtime: codex
Access: quota-session
Model: gpt-5.6-sol
Effort: high
Capabilities: repo.read, repo.write, test.run
Regression profile: RP-...
```

Credenciais e segredos nunca aparecem nesse cabeçalho.

## Anúncio obrigatório de atividade

O Morrow deve publicar eventos de alto nível antes/depois de ações relevantes. Exemplos:

```text
[14:03:01] ORCHESTRATOR  dispatch Executor para S3
[14:03:02] EXECUTOR      PRE_DISPATCH GREEN
[14:03:04] EXECUTOR      lendo contexto obrigatório
[14:03:10] EXECUTOR      executando diagnóstico complementar
[14:03:38] EXECUTOR      dúvida detectada: evidência D-17 ambígua
[14:03:39] EXECUTOR      solicitando reunião
[14:03:40] ORCHESTRATOR  reunião M-08 aberta
[14:03:41] DIAGNOSTICIAN entrou na reunião
[14:05:12] MEETING M-08  decisão: novo diagnóstico necessário
[14:05:13] ORCHESTRATOR  rota → DIAGNOSTIC
[14:08:44] DIAGNOSTICIAN evidência D-21 registrada
[14:08:45] ORCHESTRATOR  rota → EXECUTION
[14:12:20] EXECUTOR      mudança candidata pronta
[14:12:21] REGRESSION    checks obrigatórios iniciados
[14:13:10] REVIEWER      nova revisão iniciada
```

Esses anúncios não são narrativa livre confiada ao modelo. Sempre que possível, são gerados pelo kernel a partir de eventos reais: dispatch, lock, workspace, tool call, reunião, gate, checkpoint, teste, commit, mudança de rota e encerramento.

Agentes podem acrescentar uma explicação semântica curta, mas o evento mecânico é a fonte de verdade.

## Visualização simultânea do time

O operador deve poder acompanhar múltiplos AgentInstances ativos ao mesmo tempo.

Implementações possíveis:

- Windows Terminal com tabs/panes;
- terminal multiplexer compatível com o sistema operacional;
- painel local que espelha PTYs/process streams;
- futura UI do Morrow com terminal por agente e feed consolidado.

A implementação não é constitucional. O requisito é.

Exemplo conceitual:

```text
┌ ORCHESTRATOR ─────────────┬ EXECUTOR ────────────────┐
│ mapa / decisões / dispatch│ CLI trabalhando ao vivo │
├───────────────────────────┼──────────────────────────┤
│ DIAGNOSTICIAN             │ REVIEWER                 │
│ medições / achados        │ revisão independente     │
├───────────────────────────┴──────────────────────────┤
│ LIVE ACTIVITY FEED / MEETING ROOM                    │
└──────────────────────────────────────────────────────┘
```

Não é obrigatório manter todos os papéis com sessão aberta. Apenas instâncias ativas aparecem; papéis inativos não consomem cota.

## Sala de reunião observável

Quando `MEETING_OPEN` ocorrer, o operador deve ver:

- meeting id;
- dúvida/contradição que motivou a reunião;
- contrato/step;
- participantes convidados e presentes;
- posição/proposta factual de cada papel;
- evidências referenciadas;
- decisão do Orchestrator;
- efeito no mapa/memória viva;
- rota de retorno.

A conversa pode ser exibida como feed compartilhado e/ou pane próprio. O registro canônico continua no Event Log/artefatos, não na memória transitória da tela.

## Transparência de comandos e ferramentas

Quando política de segurança permitir, a sessão deve mostrar:

- comando/ferramenta invocada;
- cwd/workspace;
- capability usada;
- início/fim e exit code;
- resumo de arquivos/superfícies alterados;
- testes/checks iniciados e resultados.

Segredos, tokens e variáveis sensíveis devem ser redigidos antes de qualquer espelhamento.

## Provider CLI real

No modo quota-session local, o operador deve reconhecer a execução real do provider (`codex`, `claude`, etc.).

O fato de uma CLI instalada via npm ser internamente implementada em Node.js não transforma o AgentInstance em um "agente Node". Node pode ser somente o runtime técnico do binário/shim e/ou do control plane.

O requisito operacional é que o Morrow preserve a experiência e o stream da CLI real, em vez de esconder a execução atrás de um JSON final.

## Captura + visibilidade

Visibilidade não elimina registro estruturado. O Morrow precisa de ambos:

1. **live stream humano** — para supervisão e confiança;
2. **eventos/artefatos estruturados** — para checkpoint, auditoria, memória e retomada.

Um terminal visível sozinho não é memória institucional. Um Event Log sozinho não é boa experiência operacional.

## Intervenção humana

O operador pode observar sem microgerenciar. Intervenção manual deve ser explícita e registrada, por exemplo:

- pausar instância;
- pedir reunião;
- alterar routing/effort autorizado;
- responder owner decision;
- cancelar execução;
- abrir terminal em modo interativo quando a política permitir.

A intervenção vira evento; não pode ficar invisível para os demais agentes.

## Falhas e espera

Uma instância não pode parecer "parada" sem contexto. O feed deve distinguir:

- raciocinando/aguardando resposta do provider;
- executando tool/comando;
- aguardando lock;
- aguardando cota/reset;
- aguardando outro papel;
- aguardando owner decision;
- bloqueada por gate;
- timeout/falha;
- concluída.

## Requisito para Runtime V0

Antes de considerar o Runtime V0 pronto para um contrato ponta a ponta, precisamos provar pelo menos:

1. uma AgentInstance quota-session com output espelhado ao vivo;
2. anúncios de `PRE_DISPATCH`, início, tool/process, fim e checkpoint;
3. duas AgentInstances observáveis numa mesma execução;
4. uma reunião observável entre pelo menos dois papéis + Orchestrator;
5. transcript/eventos reidratáveis após restart;
6. redaction de segredo antes de qualquer stream persistido/exibido.

## Regra central

**O Morrow pode automatizar o trabalho; não deve esconder o trabalho do operador.**
