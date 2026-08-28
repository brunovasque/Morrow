# Grafo governado de execução do contrato

O kernel governa **invariantes, permissões e evidências**, não uma sequência rígida de fases. Agentes devem ter liberdade para voltar, questionar, medir novamente, refazer, revisar e auditar quantas vezes forem necessárias para cumprir o objetivo sem regressão.

## Princípio

**Mecânico nas cercas; flexível no raciocínio e na rota.**

O contrato define o destino. O mapa define uma rota inicial e viva. O grafo de execução permite loops e retornos quando houver causa registrada.

O kernel nunca deve bloquear uma ação apenas porque "essa fase já passou" quando a ação é necessária para esclarecer, provar ou preservar o contrato.

## Marcos obrigatórios

Há marcos que precisam existir antes de determinados poderes/resultados, mas eles não formam uma esteira irreversível:

- contrato identificável e destino explícito;
- dúvidas bloqueantes resolvidas antes do primeiro write;
- mapa suficiente para iniciar com segurança;
- PRE_DISPATCH verde antes de cada AgentInstance;
- prova e anti-regressão antes de aceitar mudança;
- revisão/auditoria/acceptance quando exigidas pelo risco/contrato;
- triagem de débitos e aprendizado antes do fechamento.

Depois do primeiro write, qualquer desses instrumentos pode ser reaberto quando surgir evidência nova.

## Grafo conceitual

```text
                 ┌───────────────┐
                 │    DEBATE     │◄──────────────┐
                 └──────┬────────┘               │
                        │                        │
          ┌─────────────▼─────────────┐          │
          │ DIAGNÓSTICO / MEDIÇÃO     │◄─────┐   │
          └─────────────┬─────────────┘      │   │
                        │                    │   │
                 ┌──────▼──────┐             │   │
                 │ MAPA / ROTA │◄────────┐   │   │
                 └──────┬──────┘         │   │   │
                        │                │   │   │
                 ┌──────▼──────┐         │   │   │
                 │  EXECUÇÃO   │─────────┘───┘───┘
                 └──────┬──────┘
                        │
             ┌──────────▼──────────┐
             │ PROVA / REGRESSÃO   │
             └──────┬───────┬──────┘
                    │       │ falha/dúvida
                    │       └──────────────► diagnóstico/debate/mapa/execução
                    │
              ┌─────▼─────┐
              │  REVIEW   │──── achado ────► execução/diagnóstico/debate
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │   AUDIT   │──── achado ────► prova/execução/diagnóstico/debate
              └─────┬─────┘
                    │
            ┌───────▼────────┐
            │   ACCEPTANCE   │──── falha ───► rota adequada
            └───────┬────────┘
                    │
             objetivo comprovado
                    │
             fechamento governado
```

Nenhuma seta de retorno é erro por si só. O erro é retornar sem causa/evidência ou alterar destino silenciosamente.

## Conversas e reuniões em qualquer momento

`MEETING_OPEN` é um subfluxo disponível em **qualquer estado ativo** do contrato quando houver dúvida, contradição ou conflito relevante.

Qualquer papel pode solicitar reunião. O Orchestrator participa obrigatoriamente e mantém o destino visível.

Saídas possíveis continuam sendo:

- `CLARIFIED`;
- `DIAGNOSTIC_REQUIRED`;
- `OWNER_DECISION_REQUIRED`;
- `DEBT_RECORDED`;
- `CONTRACT_CONFLICT`.

A reunião pode mandar o fluxo de volta para diagnóstico, mapa, execução, prova, revisão ou auditoria conforme a decisão registrada.

## Reabertura é permitida

Exemplos legítimos:

- Executor recebe diagnóstico ambíguo → reunião → novo diagnóstico → Executor retoma;
- Reviewer encontra comportamento não medido → Diagnostician mede → mapa ajusta rota → Executor corrige → Reviewer revisa novamente;
- Auditor quebra uma prova → Test Designer/Executor refazem instrumento/implementação → Auditor roda novamente;
- Acceptance detecta que tecnicamente está correto, mas não entrega o objetivo → volta à rota adequada sem trocar o destino;
- regressão aparece no final → volta para diagnóstico/execução e toda evidência afetada é invalidada/reexecutada.

Não há limite arquitetural de "uma revisão" ou "uma auditoria". Pode haver policy de custo/tentativas para detectar loop improdutivo, mas não para impedir investigação válida.

## Invalidação de evidência

Quando uma mudança posterior pode afetar evidência já verde, o kernel marca essa evidência como `STALE`/`REVALIDATION_REQUIRED` em vez de fingir que continua válida.

Exemplos:

- código mudou após Review → Review anterior pode precisar ser repetido;
- superfície coberta pela regressão mudou → checks afetados precisam rodar novamente;
- adendo alterou critério → provas relacionadas são revalidadas;
- correção após Audit → Audit precisa reconsiderar a nova cabeça.

O grafo é livre para voltar; **o verde antigo não é eterno**.

## Escrita protegida

Antes do primeiro write do contrato, CONTRACT_PREFLIGHT precisa estabelecer segurança mínima.

Depois disso, novos writes podem acontecer em diferentes voltas do grafo desde que:

1. objetivo ativo esteja ligado ao contrato/mapa;
2. PRE_DISPATCH esteja verde;
3. role/capabilities estejam autorizadas;
4. não exista decisão bloqueante aberta;
5. SCOPE_DRIFT_VETO não classifique a ação como mudança de destino não autorizada.

## Desvio de escopo

Achado novo passa por SCOPE_DRIFT_VETO:

- `IN_SCOPE_ROUTE` / `REQUIRED_BLOCKER` → rota pode ser enriquecida e execução seguir;
- `OUT_OF_SCOPE_DEBT` → registra débito e volta ao objetivo;
- `DESTINATION_CHANGE` → exige adendo/novo contrato;
- `UNMEASURED` → pode abrir diagnóstico, debate ou experimento.

A flexibilidade serve para encontrar a melhor rota; não para trocar o pedido.

## Anti-regressão como invariante transversal

Anti-regressão não é uma "fase final". Ela acompanha toda mudança relevante.

Uma alteração só pode ser aceita quando:

- cumpre o objetivo novo;
- preserva comportamento aceito que deve sobreviver;
- executa as cercas/checks aplicáveis;
- registra superfícies ainda não medidas.

Se uma volta posterior alterar uma superfície previamente aceita, a regressão afetada volta a ser exigível.

## Execução filha de débito

Débito deferido aprovado nasce ligado a `parent_contract_id` e `origin_debt_id`.

Ele pode usar um grafo menor ou diferente, mas herda:

- destino/critério já entregue que não pode regredir;
- regression inheritance manifest;
- decisões relevantes do contrato-pai;
- evidências que precisam permanecer verdadeiras.

Antes de fechar, passa por DEBT_CLOSE_REGRESSION.

## Quem governa o quê

- agentes raciocinam, debatem, medem, propõem e executam dentro das capacidades;
- Orchestrator mantém coerência entre objetivo, rota e achados;
- gates protegem invariantes e autoridade;
- State Store registra estado vivo e bloqueios;
- Event Log registra transições/retornos e suas causas;
- Policy Engine impede somente o que viola regra objetiva — não microgerencia a estratégia cognitiva.

## Sinal de rigidez excessiva

Uma regra do kernel deve ser questionada se ela impedir um agente de:

- pedir esclarecimento;
- chamar reunião;
- voltar a diagnóstico;
- repetir experimento;
- refazer implementação;
- pedir nova revisão;
- auditar novamente;
- buscar evidência adicional;

quando isso preserva o mesmo destino e respeita escopo, permissões e anti-regressão.

## Regra central

**O kernel impede atalhos perigosos; não impede inteligência.**

Morrow deve ser determinístico sobre o que é inaceitável e adaptativo sobre como chegar ao resultado.