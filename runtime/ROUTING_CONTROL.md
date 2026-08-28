# Controle de routing e effort

O Morrow nasce com controle manual como primeira classe. Automação de escolha de runtime/modelo/effort é opcional e só deve ganhar autonomia depois de existir histórico suficiente para medir qualidade.

## Modos de controle

- `manual` — o dono/configuração fixa `access_mode`, runtime/modelo e `effort` por papel ou contrato.
- `assisted` — o router sugere uma combinação e mostra o motivo; a escolha só vigora após aceite explícito ou preset previamente aprovado.
- `automatic` — o router escolhe dentro de limites aprovados e registra a decisão. Não é o padrão inicial.

A precedência é:

1. override manual do contrato/execução;
2. preset manual do projeto/target;
3. preset manual global;
4. política assistida/automática, se habilitada.

## Chaves manuais

Configuração conceitual:

```yaml
routing_control:
  mode: manual
  access_mode: quota-session   # quota-session | api | local
  runtime_id: null             # opcional; fixa uma sessão/runtime específico
  provider: null               # opcional
  model: null                  # opcional
  effort: high                 # low | medium | high | xhigh | provider-default
  api_fallback_allowed: false
```

Pode haver override por papel:

```yaml
roles:
  orchestrator:
    access_mode: quota-session
    model: null
    effort: xhigh
  executor:
    access_mode: quota-session
    effort: high
  scribe:
    access_mode: quota-session
    effort: medium
```

O schema usa valores canônicos; cada adapter traduz `effort` para o mecanismo equivalente suportado pelo runtime. Se um runtime não suportar o nível pedido, ele deve recusar ou pedir downgrade explícito — nunca degradar silenciosamente.

## API/local/cota como chave explícita

O operador pode trocar manualmente entre `quota-session`, `api` e `local` sem mudar o RoleSpec. A mudança vale somente no escopo configurado e fica registrada no Event Log.

Nenhuma configuração manual de `quota-session` pode cair para API sem `api_fallback_allowed: true` e budget explícito.

## Quando liberar automático

`automatic` só deve ser habilitado depois de haver amostra mínima definida pelo dono e métricas por combinação de papel/modelo/runtime, incluindo:

- taxa de conclusão sem intervenção;
- defeitos encontrados/escapados;
- regressões;
- voltas;
- consumo de cota;
- custo API quando houver;
- latência;
- qualidade de aceitação.

O limiar de amostra e a política de confiança são configuração, não decisão do LLM.

## Auditoria

Cada invocação registra:

- modo de controle (`manual | assisted | automatic`);
- origem da configuração efetiva;
- access mode;
- runtime/modelo;
- effort;
- qualquer override aplicado;
- se houve sugestão automática recusada ou aceita.

Assim é possível comparar posteriormente o desempenho do routing manual com o automático sem perder rastreabilidade.