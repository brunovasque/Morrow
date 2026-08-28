# Serviços determinísticos do kernel

Nem toda responsabilidade merece um LLM. O Morrow usa agentes para julgamento e produção; usa máquina determinística para garantias operacionais.

## Serviços do kernel

1. **State Store** — estado canônico de contrato, etapa, invocação e decisão.
2. **Event Log** — sequência append-only de despacho, ação, observação, resultado, recusa e transição.
3. **Checkpoint Manager** — salva e restaura execução sem repetir trabalho concluído.
4. **Scheduler / Wake** — acorda o Orchestrator por evento ou agenda, sem interpretar conteúdo.
5. **Lock Manager** — impede duas execuções incompatíveis sobre o mesmo recurso.
6. **Budget Guard** — teto por invocação, etapa, contrato, provider e período.
7. **Capability Resolver** — confere se papel/modelo/runtime possuem ferramentas e permissões exigidas.
8. **Skill Resolver** — resolve skills autorizadas a partir do plano/política; não deixa o modelo se autoautorizar.
9. **Provider Router** — escolhe adapter/modelo conforme política, custo, capacidade e disponibilidade.
10. **Secret Broker** — entrega credenciais somente ao runtime/tool que precisa, nunca à memória ou ao prompt por padrão.
11. **Sandbox Manager** — cria ambiente isolado, reproduzível e descartável para execução.
12. **Target Registry** — resolve descritores de repositório/projeto-alvo, políticas e perfis sem expor credenciais ao agente.
13. **Repository Adapter** — interface estreita para fetch/read/branch/commit/PR/status; nunca concede mais poder do que o descritor do alvo permite.
14. **Workspace Manager** — cria checkout/worktree/sandbox por contrato/etapa, fixa base SHA e garante isolamento entre alvos.
15. **Artifact Store** — guarda arquivos/saídas com hash, versão e vínculo à invocação.
16. **Retry Controller** — distingue falha transitória de volta semântica; retry técnico não vira debate de agente.
17. **Liveness Monitor** — detecta papel parado, sessão morta e mensagem não entregue.
18. **Policy/Gate Engine** — executa CONTRACT_PREFLIGHT, PRE_DISPATCH, REGRESSION_VETO, CONTRACT_CLOSE e futuros gates antes de chamar LLM ou avançar estado.

## Regra

Se a pergunta for "a máquina consegue garantir isso sem raciocínio?", a responsabilidade fica no kernel.

Exemplos: verificar hash, lock, schema de mensagem, budget, presença de campo, timeout, checkpoint, branch permitida, target autorizado e permissão NÃO são tarefas de agente.

## Consequência

O Orchestrator decide semanticamente **o que fazer a seguir**. O kernel decide mecanicamente **se a transição é permitida e como executá-la com segurança**.

O Morrow pode governar um repositório externo sem existir dentro dele. O kernel mantém o estado/contrato; o Workspace Manager e o Repository Adapter projetam somente as capacidades autorizadas sobre o alvo.
