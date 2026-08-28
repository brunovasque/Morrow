# Runtime

O runtime do Morrow será provider-neutral, quota-first e orientado a contratos. Esta fase ainda define contratos/interfaces e gates antes do código executável.

## Princípios já fixados

- papel != modelo != sessão != workspace != target;
- `quota-session`, `api` e `local` são modos nativos;
- controle manual de runtime/modelo/effort é primeira classe;
- automação de routing só ganha autoridade após evidência suficiente;
- Morrow é control plane e pode operar qualquer repositório-alvo autorizado;
- workspaces/worktrees pertencem à execução, não ao papel permanente;
- contrato/mapa/memória viva são estado externo à sessão do LLM;
- gates determinísticos impedem execução quando falta contexto, permissão, regressão ou decisão;
- execuções filhas de débito herdam a anti-regressão do contrato-pai.

## Especificações

- `ADAPTER_CONTRACT.md` — interface de invocação de modelos/runtimes;
- `ACCESS_MODES.md` — quota/API/local e Quota Guard;
- `ROUTING_CONTROL.md` — override manual, assisted e automatic;
- `TARGET_REPOSITORY_MODEL.md` — control plane x target;
- `KERNEL_SERVICES.md` — serviços determinísticos;
- `PROTOCOL_STRATEGY.md` — fronteiras MCP/A2A/event envelope.

O Runtime V0 só deve ser implementado depois de os contratos de estado, eventos, checkpoint, workspace e gates essenciais estarem coerentes entre si.