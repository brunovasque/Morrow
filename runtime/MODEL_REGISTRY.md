# Model / Runtime Registry

O registry separa a **capacidade desejada** do papel da **implementação concreta disponível hoje**.

## ModelProfile

Papéis referenciam perfis abstratos, por exemplo:

- `structured_economy`
- `coding_medium`
- `coding_high`
- `reasoning_high`
- `reasoning_max`
- `independent_review_max`
- `independent_audit_max`

Um perfil declara requisitos, não marca/provedor:

```yaml
profile: reasoning_max
requirements:
  reasoning: very-high
  context: high
  tool_use: required
  coding: optional
```

## Runtime entry

Uma instalação/sessão disponível declara, sem expor segredo:

```yaml
runtime_id: runtime-a
access_mode: quota-session
provider: <provider>
models:
  - id: <model>
    supported_profiles: [reasoning_high, reasoning_max]
    efforts: [medium, high, xhigh]
status: available
```

Configurações reais de conta, credenciais e targets privados ficam fora do core público.

## Seleção manual

O operador pode fixar qualquer combinação compatível:

```yaml
role: auditor
access_mode: quota-session
runtime_id: runtime-a
model: <model>
effort: xhigh
```

Esse override tem precedência sobre recomendação automática conforme `ROUTING_CONTROL.md`.

## Tradução de effort

O Morrow usa escala canônica:

- `low`
- `medium`
- `high`
- `xhigh`
- `provider-default`

Cada adapter declara como traduz ou se suporta cada nível. Se não suportar, não simula silenciosamente.

## Independência de papéis

Política pode declarar constraints, por exemplo:

- Reviewer não usar a mesma sessão do Executor;
- Auditor preferir família/provider diferente do Executor em risco alto;
- Scribe evitar reservar capacidade premium;
- papéis críticos manterem acesso a quota reservada.

Constraint de independência pode ser relaxada somente por configuração explícita e registrada.

## Frescura

Models/runtimes mudam rápido. Cada entrada pode declarar:

- `observed_at`;
- `deprecated`;
- capabilities conhecidas;
- métricas internas por papel;
- limitações observadas.

O registry não trata benchmark antigo como verdade eterna.

## Histórico de qualidade

O Morrow pode acumular, por combinação role/profile/runtime/model/effort:

- conclusão sem intervenção;
- regressões;
- defeitos encontrados/escapados;
- voltas;
- latência;
- consumo de cota;
- custo API;
- Acceptance.

Esses dados alimentam sugestão/automação futura, mas não anulam override manual.

## Regra

**Trocar de modelo não exige reescrever o papel. Trocar de assinatura/API/local não exige reescrever o modelo.**