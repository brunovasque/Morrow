# Runtime V0 — kernel mínimo vs engine de workflow

## Pergunta

O Morrow precisa adotar um engine externo de workflow/checkpoint agora ou o núcleo mínimo próprio é suficiente para preservar sua governança adaptativa?

## Baseline próprio já provado

A Phase 2 começou com um kernel mínimo zero-dependency de runtime:

- Event Log append-only;
- materialização de memória/estado vivo;
- PRE_DISPATCH determinístico;
- grafo de rota sem phase lock;
- reunião em qualquer ponto relevante;
- invalidação de evidência quando superfície muda;
- workspace efêmero local;
- ProcessRuntimeAdapter provider-neutral.

Este baseline não pretende substituir uma biblioteca madura. Ele existe para tornar mensuráveis os requisitos do Morrow.

## Candidato principal para comparação

LangGraph.js permanece em `TRIAL/ASSESS` como candidato a fornecer:

- checkpoint/resume;
- persistence;
- replay/time travel;
- retries;
- paralelismo;
- human-in-the-loop;
- execução durável.

## Critérios do spike

A comparação deve provar, com o mesmo mini-contrato:

1. consegue representar retornos livres entre diagnóstico, execução, review e audit sem hack de state machine linear?
2. consegue abrir reunião/subfluxo em qualquer ponto relevante?
3. consegue invalidar/reexecutar evidência afetada sem repetir trabalho não relacionado?
4. consegue persistir e reidratar contrato após kill/restart?
5. consegue manter RoleSpec/Model/Runtime/Workspace desacoplados?
6. permite PRE_DISPATCH e gates do Morrow antes de cada dispatch?
7. não obriga memória institucional ou regras de negócio dentro do framework?
8. qual é a quantidade de código próprio eliminada/adicionada?
9. qual é o custo de depuração e observabilidade?
10. qual é o risco de lock-in e dificuldade de substituir o engine depois?

## Regra de decisão

- se o framework eliminar infraestrutura commodity sem controlar a semântica do Morrow, preferir biblioteca/adapter;
- se exigir transformar o grafo adaptativo em pipeline rígido, não adotar;
- se o kernel mínimo começar a recriar durabilidade/checkpoint/replay complexos já resolvidos com qualidade, não reinventar.

Nenhum framework se torna canônico antes dessa prova comparável.
