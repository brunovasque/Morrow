# Seleção dinâmica de papéis

O Morrow possui um catálogo grande de papéis, mas não acorda a empresa inteira para cada tarefa.

## Ciclo de contrato — padrão

`Discovery -> Contract Engineer -> aprovação do dono -> Planner -> execução das etapas -> Acceptance -> retrospectiva -> Supervisor`

O Orchestrator conduz o ciclo e o Scribe mantém o estado oficial.

## Ciclo de uma etapa executável — padrão

`Experimenter -> Executor -> Reviewer -> Auditor`

A classe de risco pode reduzir ou ampliar o ciclo, mas redução precisa estar prevista em policy; o Orchestrator não omite verificação por conveniência.

## Gatilhos adicionais

| Condição | Papel |
|---|---|
| causa desconhecida / sistema existente divergindo do esperado | Diagnostician |
| decisão estrutural cara / múltiplos módulos | Architect |
| software com critérios automatizáveis relevantes | Test Designer |
| duas ou mais entregas paralelas / integração externa | Integrator |
| auth, segredo, pagamento, PII, tenant, rede, shell, permissão | Security Reviewer |

## Paralelismo

Papéis podem rodar em paralelo apenas quando:
- não escrevem no mesmo recurso;
- não dependem da conclusão um do outro;
- o estado compartilhado possui namespace/merge definido;
- existe barrier explícita antes da integração.

Reviewer e Auditor permanecem independentes: não compartilham conclusão antes de ambos terminarem.

## Skills

Após o papel ser escolhido, o Skill Resolver seleciona apenas as skills compatíveis e exigidas pelo contrato/etapa. Skill não cria permissão nova.

## Model routing

Seleção do modelo vem depois de papel + capacidades + skills. Modelo é recurso de execução, não arquitetura do processo.