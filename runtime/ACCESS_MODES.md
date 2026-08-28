# Access modes — quota-first, API-optional

Morrow separa **quem raciocina** de **como esse raciocínio é acessado**.

Um `RoleSpec` não escolhe assinatura nem API. Um `ModelProfile` descreve capacidade desejada. O `Access Router` resolve um runtime autorizado que satisfaça ambos.

## Princípio

**Quota/session é caminho de primeira classe. API é opcional.**

O Morrow deve poder operar inteiramente com clientes/CLIs autenticados por assinatura/cota quando esses runtimes oferecem automação compatível e autorizada.

## Camadas

```text
RoleSpec
  ↓
ModelProfile
  ↓
Access Policy
  ↓
Access Router
  ├─ quota/session runtime
  ├─ API runtime
  └─ local runtime
```

## Quota/session runtime

Exemplos conceituais: agente de código executado por CLI/desktop autenticado na conta do usuário, com a franquia/cota controlada pelo próprio provedor.

O adapter deve tratar a sessão como recurso escasso:

- `runtime_id` identifica a instalação/sessão;
- `provider_account_profile` é referência privada/local, nunca segredo versionado;
- `capabilities` declara modelos, reasoning levels, ferramentas e limites conhecidos;
- `availability` declara se o runtime está autenticado, livre, ocupado, limitado ou indisponível;
- `quota_snapshot` usa apenas informação que o cliente exponha de modo confiável;
- o kernel controla concorrência para não queimar a franquia com paralelismo inútil.

## API runtime

API existe para casos em que sua vantagem justifica o custo, por exemplo:

- workload programático impossível pelo runtime de cota disponível;
- lote controlado de avaliações;
- chamada curta/barata que poupa uma sessão premium;
- fallback explicitamente autorizado;
- serviço futuro multiusuário onde assinatura pessoal não é o meio apropriado.

Toda API exige budget e credencial segregada.

## Hybrid

`hybrid` não significa "use API quando quiser". Significa que o contrato/política autorizou uma lista ordenada de rotas.

Exemplo:

```yaml
access_policy:
  allowed_modes: [quota-session, api]
  preferred_mode: quota-session
  api_fallback_allowed: true
  max_api_cost_usd: 1.50
```

Sem `api_fallback_allowed`, cota esgotada é bloqueio/espera/roteamento alternativo — nunca cobrança surpresa.

## Pool de runtimes de cota

O Morrow pode manter vários runtimes disponíveis sem fixá-los ao papel:

```text
runtime/codex-a   → quota-session → perfis high/xhigh
runtime/claude-a  → quota-session → perfis medium/high/xhigh
runtime/local-a   → local         → perfis economy
```

Os nomes acima são exemplos; a configuração real é privada e dinâmica.

O router escolhe por:

1. requisitos do papel;
2. risco do objetivo;
3. independência desejada entre Executor/Reviewer/Auditor;
4. cota disponível;
5. capacidade/modelo;
6. contexto necessário;
7. latência;
8. histórico de qualidade;
9. custo monetário, se houver.

## Controle de concorrência por cota

Paralelizar agentes pode acelerar um contrato e ao mesmo tempo destruir a cota. Por isso `Quota Guard` é serviço determinístico.

Ele deve poder impor:

- máximo de sessões simultâneas por runtime/conta;
- reserva de capacidade para papéis críticos;
- preferência por modelos econômicos em papéis simples;
- pausa quando a cota entra em zona de reserva;
- prioridade entre contratos;
- retomada após reset quando o cliente expuser o horário;
- proibição de abrir N instâncias idênticas sem benefício medido.

## Reserva por papel

Uma política pode reservar os modelos/cotas mais fortes para raciocínio independente:

```yaml
routing:
  diagnostician: reasoning_max
  orchestrator: reasoning_max
  executor: coding_high
  reviewer: independent_reasoning_max
  auditor: independent_reasoning_max
  scribe: structured_economy

quota_policy:
  reserve_high_tier_for: [diagnostician, reviewer, auditor, orchestrator]
```

## Sessão não é identidade

- papel persiste como especificação;
- sessão/runtime é temporário;
- workspace pertence à execução;
- modelo pode mudar conforme política;
- memória não fica dependente da memória conversacional da sessão.

Se uma sessão morrer ou perder contexto, o kernel reidrata outra usando contrato, mapa, eventos, checkpoint, skills e memória promovida.

## Métricas

Para modo quota, dinheiro não é a única métrica. Registrar:

- duração;
- invocações;
- turnos/iterações quando medíveis;
- bloqueios por limite;
- resets observados;
- concorrência;
- intervenções humanas;
- qualidade por papel/model profile/runtime;
- custo API separado, se usado.

O objetivo é descobrir empiricamente **quanto de contrato útil cada combinação produz por unidade de cota**, e não apenas tokens por dólar.

## Regra de produto

Nenhuma feature central do Morrow pode nascer exigindo API quando existir caminho compatível por `quota-session` ou `local`. Se uma feature exigir API por natureza, isso deve estar declarado no contrato/capability antes da execução.
