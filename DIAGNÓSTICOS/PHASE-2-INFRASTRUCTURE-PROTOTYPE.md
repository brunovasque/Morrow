# DIAGNÓSTICO — infraestrutura local do Runtime V0

**Data:** 2026-08-28
**Branch:** `phase-2/runtime-v0`

## Objetivo

Provar separadamente as três peças determinísticas necessárias antes do primeiro adapter de LLM real:

1. lock/concurrency;
2. checkpoint de invocação;
3. Git worktree real.

## Prova local de protótipo

Foi executado um harness isolado no ambiente local do assistente, sem acesso de rede e sem qualquer repositório de produção.

Resultado:

```text
prototype green
```

### Lock

- primeiro owner adquire o recurso;
- segundo owner recebe `acquired: false` enquanto lease está válida;
- owner incorreto não consegue liberar lock alheio;
- owner correto libera.

### Checkpoint

- checkpoint `running` é persistido em disco;
- novo objeto/store consegue reidratá-lo;
- checkpoint é atualizado para `completed` com `resultRef`.

### Git worktree

Foi criado um repositório Git temporário local do zero, com um commit sintético. Em seguida:

- criado worktree real a partir de `HEAD`;
- criada branch isolada `contract/test` no protótipo;
- arquivo-base estava presente no worktree;
- branch ativa conferida via `git branch --show-current`;
- remoção do worktree preservou o repositório-base.

## Implementação versionada

A branch contém versões portáveis dos mecanismos:

- `src/lock-manager.ts`
- `src/checkpoint-store.ts`
- `src/git-worktree-manager.ts`
- `test/infrastructure.test.ts`

A versão Git usa `spawn(..., shell: false)` e valida que o workspace está dentro do root gerenciado antes da remoção.

## Limitação da prova

O harness local provou os mecanismos em um repositório temporário. O checkout da branch GitHub não pôde ser clonado neste ambiente porque a rede do container não resolve `github.com`; portanto a suíte completa da branch após esses commits ainda deve ser reexecutada em um worker com checkout local antes de promover a PR de draft para ready.

Isso é uma limitação de ambiente, não um verde presumido.

## Próximo bloqueio real

O primeiro adapter `quota-session` precisa rodar numa máquina onde a CLI escolhida esteja instalada e autenticada na assinatura/cota real. Sem isso não há como provar:

- autenticação por cota;
- model/effort aplicado;
- transporte não-interativo;
- comportamento de quota/reset;
- permissões reais;
- ausência de fallback para API.

## Veredito

**INFRASTRUCTURE PROTOTYPE GREEN; FULL BRANCH RE-RUN PENDING ON LOCAL WORKER.**
