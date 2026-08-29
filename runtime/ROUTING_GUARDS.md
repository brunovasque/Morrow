# Routing, Quota e Budget Guards — Runtime V0

P2-PR04 transforma a política conceitual de acesso/modelo em cercas determinísticas executadas antes de qualquer dispatch. A unidade resolve configuração e reserva recursos; ela não inicia processo, sessão, terminal, workspace, rede nem cobrança.

## Configuração efetiva

Os registries são versionados e usam referências exatas `id@version`:

- `AccessPolicyRegistry` — modos permitidos, modo preferido e autorização explícita de fallback para API;
- `ModelProfileRegistry` — capacidades abstratas exigidas pelo papel;
- `RuntimeRegistry` — provider, modo de acesso, pool de cota e modelos/efforts/capabilities realmente suportados;
- `RoutingPolicyRegistry` — configuração global e overrides de target, contrato e invocação.

A precedência mecânica é:

```text
global < target < contract < invocation
```

Cada campo da configuração final registra a policy, o escopo e o `scopeId` que o definiu. Uma policy só pode ser usada no escopo e identidade aos quais foi vinculada. A configuração global é completa; overrides são parciais e não podem introduzir campos desconhecidos.

O resolver valida a combinação final como uma unidade:

1. access mode pertence à Access Policy;
2. runtime existe, está habilitado e declara exatamente esse access mode;
3. `quota-session` possui pool explícito;
4. modelo existe naquele runtime e está habilitado;
5. modelo suporta o Model Profile, capabilities e effort exatos;
6. API não preferida exige `apiFallbackAllowed: true`;
7. API exige Budget Policy e teto positivo em unidades monetárias mínimas.

Falha em qualquer item retorna rejeição enumerada. O resolver não procura outro runtime, modelo, effort ou access mode. Assim, disponibilidade baixa não pode virar downgrade ou cobrança surpresa.

`manual`, `assisted` e `automatic` são valores auditados de uma policy aprovada, não licença para o resolver inventar rotas. Seleção/sugestão futura continua limitada às policies registradas e não altera esta regra.

## Quota Guard

O `QuotaGuard` mantém uma reserva determinística por pool versionado:

- limite de concorrência;
- snapshot mensurável com unidade, saldo, reserva crítica, observação e reset; ou estado explicitamente não mensurável;
- prioridade `standard`, que não consome a reserva crítica, e `critical`, explicitamente autorizada a usá-la;
- reserva, conclusão e liberação vinculadas ao proprietário;
- chave idempotente que não pode ser religada a outro pedido ou settlement;
- relógio injetado na construção, fora do controle de cada pedido.

Quando o provider não mede cota, a saída contém somente `measurable: false`: saldo e reset não são inventados. Snapshot vencido bloqueia; não é renovado por suposição. Falta de concorrência/cota também bloqueia sem procurar outro pool.

## Budget Guard

O `BudgetGuard` reserva valores inteiros na menor unidade da moeda declarada pela policy. Ele não usa ponto flutuante para representar unidades fracionárias e não realiza cobrança.

Cada policy fixa moeda, período e tetos de:

- invocação;
- step;
- contrato;
- provider;
- período.

Reserva considera simultaneamente valores já comprometidos e reservados, impedindo oversubscription. `commit` converte a reserva no valor real, limitado ao máximo reservado; `release` devolve apenas capacidade ainda reservada. Ownership e idempotência impedem liberação, commit duplicado ou mudança de valor por outro chamador.

## Fronteiras de confiança

- descritores e pedidos aceitam apenas objetos de dados planos, chaves exatas, referências versionadas e identificadores limitados;
- accessors, prototypes, proxies hostis, campos de comando e material de credencial são recusados;
- snapshots de registry e resultados são clonados e congelados;
- mensagens de falha não incluem exceções ou dados fornecidos por componentes internos;
- identidade/autorização de dispatch deverá fornecer os IDs governados em P2-PR05; esta PR não afirma que um pedido isolado já está autenticado;
- persistência/reidratação das reservas e atualização de snapshots pertencem a P2-PR06.

## Fora desta PR

- dispatch e ligação aos registries de Target/Role/Skill/Capability;
- execução de PowerShell, AgentInstance, processo ou terminal;
- seleção autônoma e histórico de qualidade;
- transporte, heartbeat, reconnect, retry e fila persistente;
- obtenção de cota em provider, credenciais, rede, target externo ou cobrança real.

Essas exclusões preservam o corte contratual: P2-PR04 prova as cercas; P2-PR05 será o primeiro ponto autorizado a conectá-las ao dispatch.
