# Registries de governança e Secret Broker boundary — P2-PR03

Esta etapa cria a resolução mecânica que precede qualquer dispatch. Ela não executa processo, não abre shell, não acessa repositório e não carrega credencial real.

## Registros explícitos

O V0 mantém cinco catálogos imutáveis em memória:

- **Target Registry**: identidade do target, referência opaca do repositório, base, modo de escrita, caminhos, checks, políticas e combinações permitidas;
- **Role Registry**: versão do papel, skills e capabilities permitidas e capabilities obrigatórias;
- **Skill Registry**: versão da skill, papéis permitidos e capabilities de que ela depende;
- **Capability Registry**: versão, tipo, risco e estado habilitado;
- **Secret Policy Registry**: regras exatas de referência, finalidade, consumidor e capability de segredo.

Os construtores validam schema estrito, clonam e congelam os registros. IDs duplicados, versões inválidas, campos extras, accessors e políticas de caminho absolutas ou com travessia são recusados. Nenhum registry possui target, papel, skill ou capability padrão.

`repositoryLocatorRef` e `secretRef` são referências opacas. Caminho/URL privado de repositório e material de credencial não pertencem a estes registros públicos.

## Resolução de autoridade

`GovernanceResolver.resolve()` recebe um pedido estrito com contrato, etapa, target, papel versionado, ao menos uma skill, capabilities e pedidos opcionais de segredo. A ordem de decisão é:

1. target existe e está habilitado;
2. papel existe na versão exata, está habilitado e é permitido pelo target;
3. cada capability existe na versão exata, está habilitada e é permitida por target e papel;
4. capabilities obrigatórias do papel estão presentes;
5. cada skill existe na versão exata, está habilitada e é permitida por target, papel e pela própria skill;
6. capabilities obrigatórias de cada skill estão presentes;
7. a secret policy do target existe e está habilitada, mesmo quando o trabalho não solicita segredo;
8. cada pedido de segredo coincide exatamente com regra, finalidade, consumidor e capability `secret-use` já resolvida.

Qualquer ausência ou incompatibilidade produz recusa enumerada. O resolver não faz fallback, não procura “o target mais próximo” e não deixa texto de chat criar autoridade.

O resultado é uma cópia congelada destinada ao kernel/gate. Integração com o envelope autenticado da P2-PR01 e consumo de dispatch pertencem à P2-PR05.

## Fronteira do Secret Broker

O resolver devolve apenas uma aprovação opaca de acesso. Ela contém referências e escopo, nunca senha, token, chave, variável de ambiente ou sessão autenticada.

`SecretBrokerBoundary` aceita somente o próprio objeto emitido pelo resolver naquela instância de processo. Uma cópia estruturalmente idêntica é recusada antes de chamar o emissor. Isso impede que um agente fabrique uma aprovação em JSON dentro deste V0 local.

O emissor privado do broker pode devolver somente:

```text
handleId + consumer + delivery:opaque-handle + expiresAt
```

O handle precisa pertencer ao mesmo consumidor, expirar em no máximo cinco minutos e não pode conter campo extra. Se o emissor tentar devolver `token`, `value`, `credential` ou qualquer material, o boundary recusa o objeto inteiro. Erros do emissor são convertidos em código sanitizado e não atravessam a fronteira.

Emissões concorrentes ou retries sobre a mesma aprovação compartilham uma única operação e devolvem o mesmo resultado. Um `handleId` já associado a outra aprovação é recusado. Essa idempotência vale para a instância local; persistência e replay depois de restart continuam reservados à P2-PR06.

A aprovação em memória não é persistível nem reutilizável após restart. P2-PR06 deverá reidratar/reautorizar por artefato durável e protegido contra replay; não serializar este objeto é uma cerca deliberada desta etapa.

## Fora desta PR

- armazenamento, leitura ou rotação de credencial real;
- transporte autenticado ou conexão de rede;
- routing, modelo, access mode, quota e budget: P2-PR04;
- integração do resolver ao dispatch, locks, workspace, PowerShell e AgentInstance: P2-PR05;
- persistência/replay/recovery de autorização: P2-PR06;
- terminal ConPTY: P3.

Enova e qualquer target externo permanecem proibidos. Os testes usam somente descritores fictícios em memória.
