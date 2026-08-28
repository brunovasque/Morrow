# DIAGNÓSTICO — Phase 2 / Runtime V0 baseline

**Data:** 2026-08-28
**Branch:** `phase-2/runtime-v0`
**Escopo:** kernel mínimo local, sem provider real e sem target de produção.

## Objetivo medido

Provar que o primeiro runtime consegue sustentar as cercas essenciais sem transformar o contrato em pipeline rígido.

## Provas executadas localmente

Comando:

```bash
npm test
```

Ambiente medido:

- Node.js `v22.16.0`
- npm `10.9.2`
- execução TypeScript V0 via `--experimental-strip-types`

Resultado final:

```text
1..8
# tests 8
# pass 8
# fail 0
```

### Casos verdes

1. reidrata memória/estado vivo apenas pelo Event Log append-only;
2. PRE_DISPATCH recusa capability ausente e contrato bloqueado antes de chamar agente;
3. grafo permite `Review -> Diagnostic -> Execution -> Review -> Audit -> Execution -> Audit` sem phase lock;
4. reunião pode abrir durante Review e devolver o trabalho a Diagnostic;
5. mudança em superfície coberta torna evidência anterior `stale` em vez de preservar falso verde;
6. workspace local efêmero nasce isolado por contrato/instância e pode ser destruído;
7. ProcessRuntimeAdapter passa prompt por stdin e funciona em modo `quota-session` sem conhecer provider;
8. timeout do runtime é aplicado mecanicamente.

## Falhas encontradas durante o spike

### F1 — sintaxe TypeScript incompatível com strip-only

Primeira rodada falhou porque parameter properties (`constructor(private readonly ...)`) não são suportadas pelo type stripping nativo usado neste V0.

**Correção:** propriedades tornadas explícitas no corpo da classe.

**Classificação:** tooling/runtime compatibility; não altera arquitetura.

### F2 — criação de workspace filho sem diretório do contrato

A primeira prova de workspace falhou porque o manager tentava criar `contract/workspace` com `recursive: false` antes de criar `contract`.

**Correção:** cria primeiro o root do contrato e depois o workspace exclusivo.

**Classificação:** implementação do Workspace Manager.

## O que NÃO foi provado ainda

- adapter real de Codex/Claude por cota;
- leitura de quota/reset de qualquer provider;
- git worktree real;
- repository adapter GitHub;
- connector externo;
- locks concorrentes;
- checkpoint de processo em voo;
- secret broker;
- gate completo de regressão herdada de débito;
- execução de contrato real ponta a ponta;
- LangGraph.js versus kernel mínimo.

## Observação sobre TypeScript

`--experimental-strip-types` serve somente para manter o V0 zero-dependency durante o spike. Não é decisão canônica de toolchain. A Phase 2 deve decidir build/test TypeScript estável antes de declarar runtime pronto para uso real.

## Veredito

**BASELINE V0 GREEN — 8/8 provas locais.**

O núcleo mínimo já prova o princípio mais importante desta rodada: o runtime consegue impor cercas objetivas sem impor ordem cognitiva rígida aos agentes.
