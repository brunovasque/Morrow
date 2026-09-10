# Workspace Manager

Workspace é o ambiente isolado onde uma instância observa, testa ou modifica um target. Ele pertence à **execução**, não ao papel permanente.

## Estratégias possíveis

O adapter do target pode implementar:

- Git worktree;
- clone isolado;
- container/sandbox com checkout;
- workspace remoto equivalente.

A semântica do kernel é a mesma.

## Nascimento

Todo workspace registra:

- `workspace_id`;
- `contract_id` e `map_step`;
- `target_id`;
- base ref e **pinned base SHA**;
- estratégia usada;
- branch/ref candidata, quando houver;
- modo: `read-only | test | write | review | audit`;
- paths/capabilities autorizados;
- lock scope;
- artifact/log scope.

O workspace deve ser criado pelo kernel/adapter, não por decisão informal do agente.

## Perfis por papel

### Diagnostician / Experimenter

Preferência: workspace read-only/test contra base conhecida.

### Executor

Workspace write isolado, branch do contrato/step e escopo de escrita explícito.

### Reviewer

Preferencialmente checkout limpo do candidate/head produzido, com contexto de contrato e diff, sem depender da pasta/sessão do Executor.

### Auditor

Workspace limpo próprio. Reroda provas e contraprovas a partir do candidate verificável.

### Acceptance

Pode usar build/ambiente derivado do candidate em superfície próxima do usuário final.

## Paralelismo

Workspaces diferentes podem existir em targets diferentes ou no mesmo target quando locks e dependências permitem.

O Lock Manager impede colisões incompatíveis, por exemplo duas execuções escrevendo na mesma área/branch sem estratégia de integração.

O Terminal Session Manager aceita somente um descritor emitido sob sua raiz gerenciada, exige correspondência de contrato/papel/workspace e reserva o workspace enquanto a sessão está ativa. Diretório atual ou terminal aberto pelo operador não é um workspace implícito.

## Base e drift

Cada step sabe de qual SHA nasceu.

Se o target avançar durante a execução, o kernel registra drift. Rebase/restack/refresh não acontece silenciosamente; deve revalidar regressão e dependências afetadas.

## Reviewer/Auditor e independência

Nunca assumir que "passou no workspace do Executor" é prova suficiente.

A reexecução em ambiente limpo reduz dependência de estado escondido, arquivos não commitados, caches e raciocínio correlacionado.

## Descarte

Workspace pode ser descartado depois que:

- artefatos necessários foram persistidos;
- estado Git/candidate está identificável;
- logs/evidências foram capturados;
- nenhum gate exige inspeção adicional.

Falha em um workspace não pode corromper control plane, protected base, outro contrato ou outro target.

## Regra

**Worktree é uma implementação possível de workspace. O contrato do Morrow é o isolamento e a rastreabilidade, não um diretório permanente por agente.**
