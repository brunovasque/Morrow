# Connector architecture

Morrow trata serviços externos como capabilities governadas, não como poderes implícitos do agente.

## Exemplos de conectores

- source control / Git hosting;
- deploy/hosting;
- edge/network/CDN;
- databases/BaaS;
- observability;
- CI/CD;
- messaging;
- design/content systems;
- cloud providers e serviços específicos.

Vercel, Cloudflare, Supabase e equivalentes entram nessa camada por connector/adapter, preferencialmente via padrão aberto como MCP quando houver implementação adequada; caso contrário, por adapter fino próprio.

## Princípios

1. connector != skill != agent;
2. connector expõe capacidades; o kernel decide quem pode usá-las;
3. credenciais passam pelo Secret Broker, nunca pelo prompt por padrão;
4. cada target declara quais connectors são permitidos;
5. leitura, escrita, deploy, migração de banco e destruição são capacidades separadas;
6. permissões seguem menor privilégio;
7. toda chamada mutável gera Event Log e evidência;
8. ações irreversíveis/destrutivas exigem política/gate específico;
9. connector indisponível bloqueia a capability, não autoriza workaround silencioso.

## Capability examples

```text
vercel.read_project
vercel.preview_deploy
vercel.production_deploy
cloudflare.read_dns
cloudflare.edit_worker
cloudflare.edit_dns
supabase.read_schema
supabase.query_readonly
supabase.migrate_schema
supabase.deploy_edge_function
```

O fato de um runtime possuir um connector não significa que o agente recebeu todas as suas operações.

## Target binding

Um target pode declarar:

- connectors exigidos;
- capabilities permitidas por papel;
- ambientes (`dev | preview | staging | production`);
- gates antes de mutações;
- rollback obrigatório;
- credenciais/profiles privados a resolver fora do repositório público.

Exemplo: Executor pode editar código e publicar preview; Integrator pode validar preview; produção pode permanecer proibida até Reviewer + Auditor + Acceptance e policy de deploy.

## Extensibilidade

Novos connectors devem ser instaláveis sem alterar RoleSpecs existentes. O Capability Resolver anuncia quais operações existem; o mapa exige apenas capabilities canônicas. Adapters traduzem capability canônica para o provedor real.

## Regra

Morrow deve conseguir trabalhar em um repositório que dependa de infraestrutura externa sem precisar incorporar essa infraestrutura ao kernel. O kernel governa; connectors operam.