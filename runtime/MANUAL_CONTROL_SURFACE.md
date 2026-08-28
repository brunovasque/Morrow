# Superfície manual de controle

O routing manual deve ser operável sem editar código.

## Escopos

O operador escolhe onde a configuração vale:

- global;
- target/projeto;
- contrato;
- papel;
- invocação específica, quando autorizado.

A precedência continua definida em `ROUTING_CONTROL.md`.

## Controles mínimos

A mesma interface canônica deve poder ser exposta primeiro por CLI/config validada e depois por UI:

```text
Control mode: MANUAL | ASSISTED | AUTOMATIC
Access mode:  QUOTA | API | LOCAL
Runtime:      <seleção disponível>
Model:        <seleção compatível>
Effort:       LOW | MEDIUM | HIGH | XHIGH | DEFAULT
API fallback: OFF | ON
API budget:   <valor, somente quando aplicável>
```

## Effective Configuration

Antes de executar, o sistema mostra a configuração efetiva resultante de presets e overrides:

- origem da configuração;
- access mode;
- runtime;
- model;
- effort;
- fallback permitido ou não;
- budget/cota relevante.

O operador deve conseguir trocar manualmente cota/API/local, modelo e effort dentro das capacidades disponíveis.

## Sem downgrade silencioso

Se a combinação escolhida não puder ser satisfeita, o sistema bloqueia ou pede nova escolha. Não reduz effort, muda access mode nem cai para API silenciosamente.

## Auditoria

Toda mudança registra ator, escopo, valor anterior, valor novo e timestamp no Event Log.

## Regra

O modo automático pode amadurecer com dados; a chave manual permanece disponível como autoridade explícita do operador.