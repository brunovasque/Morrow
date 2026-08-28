# Máquina de estados do contrato

O fluxo do contrato é governado pelo kernel. Agentes produzem julgamento e artefatos; **não escolhem pular estados**.

## Estados canônicos

```text
DRAFT
  ↓
DISCOVERY
  ↓
DIAGNOSTIC_BASELINE          (quando aplicável)
  ↓
QUESTION_ROUND_1
  ↓
QUESTION_RESOLUTION
  ↓
QUESTION_ROUND_2
  ↓
EXECUTION_MAP_READY
  ↓
CONTRACT_PREFLIGHT
  ↓
READY_FOR_EXECUTION
  ↓
EXECUTING_STEP
  ↓
STEP_PROOF
  ↓
REVIEW
  ↓
AUDIT                        (quando exigido)
  ↓
STEP_ACCEPTED
  ↘ próximo step → EXECUTING_STEP
  ↓ último step
FINAL_REGRESSION
  ↓
ACCEPTANCE
  ↓
DEBT_TRIAGE
  ↓
RETROSPECTIVE_INDEPENDENT
  ↓
RETROSPECTIVE_MEETING
  ↓
LEARNING_SUPERVISION
  ↓
CONTRACT_CLOSE
  ↓
CLOSED
```

## Estados de interrupção

Qualquer etapa pode ir para:

- `BLOCKED_QUESTION`
- `BLOCKED_DIAGNOSTIC`
- `BLOCKED_OWNER_DECISION`
- `BLOCKED_SCOPE_CONFLICT`
- `BLOCKED_REGRESSION`
- `BLOCKED_CAPABILITY`
- `BLOCKED_QUOTA`
- `BLOCKED_ENVIRONMENT`

O motivo e a condição de retomada são persistidos.

## Sala de reunião

Uma reunião é um subfluxo governado:

```text
EXECUTING_STEP
  ↓ dúvida
MEETING_OPEN
  ↓
CLARIFIED | DIAGNOSTIC_REQUIRED | OWNER_DECISION_REQUIRED | DEBT_RECORDED | CONTRACT_CONFLICT
```

`CLARIFIED` só retorna à execução depois de a decisão aparecer no mapa/memória viva. Reunião não altera destino por consenso.

## Escrita protegida

O primeiro write só é permitido em `READY_FOR_EXECUTION`/`EXECUTING_STEP` e após PRE_DISPATCH verde.

Nenhum adapter/modelo recebe capacidade de escrita em estados anteriores.

## Fechamento de etapa

`EXECUTING_STEP` não vai direto a `STEP_ACCEPTED`.

Precisa passar por:

1. prova do objetivo;
2. REGRESSION_VETO;
3. Reviewer quando exigido;
4. Auditor quando exigido;
5. atualização da memória viva.

O kernel verifica presença/status dos artefatos. Relato do Executor não muda o estado sozinho.

## Desvio de escopo

Achado novo passa por SCOPE_DRIFT_VETO:

- `IN_SCOPE_ROUTE` / `REQUIRED_BLOCKER` → mapa pode ser atualizado;
- `OUT_OF_SCOPE_DEBT` → registra débito e retorna ao objetivo;
- `DESTINATION_CHANGE` → bloqueia por adendo/novo contrato;
- `UNMEASURED` → diagnóstico/medição.

## Mudança de contrato

Adendo aprovado produz transição controlada para revalidação:

```text
BLOCKED_SCOPE_CONFLICT
  ↓ owner approves addendum
ADDENDUM_APPLIED
  ↓
QUESTION_REVALIDATION
  ↓
MAP_REVALIDATION
  ↓
CONTRACT_PREFLIGHT
```

Não se volta silenciosamente à execução.

## Execução filha de débito

Débito deferido aprovado nasce como `CHILD_DRAFT`, ligado a `parent_contract_id` e `origin_debt_id`.

Ele percorre o mesmo trilho, podendo simplificar etapas somente quando o gate declarar `not-applicable` com regra explícita.

Antes do write, recebe `regression_inheritance_manifest`.

Antes de `CHILD_CLOSED`, passa por DEBT_CLOSE_REGRESSION.

## Quem controla transições

- agentes **propõem** resultado semântico;
- Orchestrator valida a interpretação/rota;
- gates verificam pré-condições;
- **State Store/Policy Engine executam a transição**;
- Event Log registra `from`, `to`, causa, ator, evidência e hash do estado.

Nenhum prompt possui autoridade para alterar estado diretamente.

## Regra central

**Cumprir a etapa não depende de o LLM lembrar que ela existe. A etapa existe no kernel, e sem seu gate verde o próximo estado é inalcançável.**