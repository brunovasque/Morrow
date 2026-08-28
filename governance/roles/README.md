# Papéis

Papéis são contratos de responsabilidade, independentes do fornecedor/modelo.

**Papel != modelo != skill.** Um mesmo papel pode ser ocupado por modelos diferentes. Uma mesma skill pode especializar papéis diferentes. O kernel escolhe a combinação adequada por contrato e risco.

## Núcleo do ciclo de contrato

Estes papéis formam a empresa, mas não necessariamente rodam em cada etapa:

1. [Orchestrator / Brain](ORCHESTRATOR.md) — conduz o contrato inteiro; não executa.
2. [Discovery](DISCOVERY.md) — entrevista o dono/cliente e transforma intenção vaga em problema entendido.
3. [Contract Engineer](CONTRACT_ENGINEER.md) — transforma entendimento em destino observável e critérios de encerramento.
4. [Planner](PLANNER.md) — transforma o contrato imutável em rota corrigível.
5. [Experimenter](EXPERIMENTER.md) — simula o pedido antes da execução e procura furos de instrução.
6. [Executor](EXECUTOR.md) — produz o artefato autorizado e prova o resultado.
7. [Reviewer](REVIEWER.md) — revisão independente do que foi produzido, sem receber justificativa do executor.
8. [Auditor](AUDITOR.md) — audita a prova e tenta demonstrar que o verde é falso.
9. [Acceptance](ACCEPTANCE.md) — confere o produto como usuário/cliente contra o contrato, não contra o código.
10. [Scribe](SCRIBE.md) — registra fatos e decisões sem se tornar autor delas.
11. [Supervisor de aprendizado](SUPERVISOR.md) — no fechamento, transforma repetição em proposta de regra, remoção ou cerca.

## Papéis acionados por necessidade

12. [Diagnostician](DIAGNOSTICIAN.md) — mede causa e estado real em modo read-only; não propõe solução.
13. [Architect](ARCHITECT.md) — define fronteiras, interfaces e decisões técnicas quando a complexidade exige desenho anterior à execução.
14. [Test Designer](TEST_DESIGNER.md) — escreve a estratégia de prova antes do código quando o contrato exige software/automação verificável.
15. [Integrator](INTEGRATOR.md) — integra entregas paralelas ou módulos independentes e mede incompatibilidades entre eles.
16. [Security Reviewer](SECURITY_REVIEWER.md) — entra por gatilho de risco: autenticação, segredo, pagamento, PII, rede, permissão, execução arbitrária ou superfície equivalente.

Todos obedecem à [regra comum](COMMON.md).

## O que NÃO vira papel

Relógio, lock, budget, retry, fila, checkpoint, roteamento de provider, seleção de skill, armazenamento de segredo, sandbox e event log são serviços determinísticos do kernel. Não gastamos um LLM para fazer o que uma máquina pode garantir.

## Skills

Especialização de domínio não cria papel automaticamente. `brand-identity`, `slogans`, `campaigns`, `frontend`, `database`, `accessibility` ou qualquer outro domínio entram como skills carregadas sobre o papel certo.

Exemplo: criar slogan pode ser `Executor + skill slogans`; revisar aderência à marca pode ser `Reviewer + skill brand-identity`; testar o resultado com o briefing pode ser `Acceptance + skill brand-voice`.
