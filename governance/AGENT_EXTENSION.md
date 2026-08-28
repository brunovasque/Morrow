# Extensibilidade de agentes e papéis

O catálogo inicial de papéis não é fechado. Morrow deve permitir adicionar papéis/agentes especializados futuramente sem alterar o kernel.

## Separação

- **RoleSpec**: responsabilidade operacional, entradas, saídas, permissões e gates;
- **Skill**: conhecimento/procedimento especializado carregável por um ou mais papéis;
- **AgentInstance**: execução efêmera de um RoleSpec em um contrato;
- **Model/runtime**: motor usado naquela instância.

## Quando criar uma skill

Prefira skill quando o trabalho continua pertencendo a um papel existente, mas exige conhecimento especializado.

Exemplos: frontend, segurança web, branding, vídeo, infraestrutura cloud, domínio regulatório.

## Quando criar um novo papel

Crie novo RoleSpec quando houver responsabilidade independente que precise de:

- missão própria;
- autoridade/limites diferentes;
- entrada e saída próprias;
- independência de outro papel;
- gate próprio ou separação de conflito de interesse;
- recorrência observada em mais de um contrato ou necessidade explícita de alto risco.

Não crie papel novo apenas para dar nome a uma skill.

## Descoberta dinâmica

O Role Catalog deve ser versionado e carregado pelo kernel. O Planner/Orchestrator pode selecionar papéis disponíveis conforme contrato, risco e capabilities, mas não pode inventar um RoleSpec inexistente em runtime.

Novos papéis entram por processo governado:

1. necessidade registrada;
2. desenho do RoleSpec;
3. state-of-art scan quando aplicável;
4. testes do papel e limites;
5. revisão/auditoria;
6. registro no catálogo;
7. versão e compatibilidade.

## Especialistas efêmeros

Um contrato pode instanciar vários especialistas do mesmo papel com skills diferentes, por exemplo:

```text
Executor + skill/frontend
Executor + skill/backend
SecurityReviewer + skill/cloud-edge
Architect + skill/data-platform
```

Eles são instâncias distintas e podem usar modelos/runtimes distintos.

## Regra

O kernel não contém lista rígida de 'N agentes'. Ele contém contratos de extensão e um catálogo governado. A organização pode crescer conforme evidência sem perder separação de responsabilidade.