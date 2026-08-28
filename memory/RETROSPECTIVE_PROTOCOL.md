# Protocolo de retrospectiva

Roda ao final de cada objetivo relevante e obrigatoriamente no fechamento do contrato.

A retrospectiva tem duas fases para reduzir efeito manada: **relato independente primeiro, reunião coletiva depois**.

## Fase 1 — relato independente por papel

Antes de ver o relato dos demais, cada papel responde:

1. principal acerto;
2. principal dificuldade;
3. erros próprios observados;
4. erros/ambiguidades no pedido/contexto recebido;
5. informação que faltou;
6. `PREFLIGHT_MISS` que poderia ter sido antecipado;
7. reuniões abertas e se realmente eram necessárias;
8. tentativas de scope drift ou débitos encontrados;
9. regressões detectadas, escapadas ou cercas ausentes;
10. instrumento/gate que ajudou;
11. instrumento/gate que falhou, não acendeu ou não foi executado;
12. desperdício de cota/tempo/retry;
13. sugestão concreta de `RULE | CHECKLIST | FENCE | SKILL_PATCH | ROUTING_POLICY | TOOLING_CHANGE | REMOVAL`;
14. algo que não conseguiu medir.

A resposta do próprio agente sobre seu erro é evidência útil, mas não prova suficiente sozinha.

## Fase 2 — reunião coletiva de aprendizado

Depois de congelar os relatos independentes, abre-se uma reunião com os papéis participantes relevantes.

O Supervisor conduz; o Orchestrator participa para explicar decisões de coordenação e mapa; o Scribe registra.

A reunião compara divergências e responde:

- qual foi a causa mais provável de cada erro relevante?
- o erro nasceu de contrato, preflight, diagnóstico, mapa, execução, ferramenta, revisão, auditoria, modelo, routing ou ambiente?
- era evitável antes da execução?
- qual mecanismo teria impedido a repetição?
- a melhoria deve virar texto, skill, ferramenta, gate, teste ou remoção?
- existe risco de corrigir um caso e piorar outros?
- que evidência futura provará que aprendemos?

Discordâncias não são apagadas. Ficam registradas com evidência e nível de confiança.

## Taxonomia mínima de causa

- `SPECIFICATION`
- `MISSING_CONTEXT`
- `PREFLIGHT`
- `DIAGNOSTIC`
- `EXECUTION_MAP`
- `ROLE_HANDOFF`
- `SKILL_GAP`
- `TOOLING`
- `MODEL_BEHAVIOR`
- `ROUTING_EFFORT`
- `TEST_REGRESSION_GAP`
- `REVIEW_AUDIT_GAP`
- `ENVIRONMENT`
- `OWNER_DECISION`
- `UNKNOWN`

## Consolidação

O Supervisor compara a rodada com histórico de erros, reuniões, recusas, regressões e contratos anteriores. Ele propõe candidatos; não promove automaticamente.

Classificação:

- `EPHEMERAL`
- `CONTRACT_LESSON`
- `CANDIDATE_LEARNING`
- `PROMOTED` somente após `LEARNING_PROMOTION`.

## Regra contra burocracia acumulada

Se uma dificuldade recorrente pode ser eliminada por simplificação, remoção ou cerca determinística, não preferir automaticamente adicionar mais instrução ao prompt.

O objetivo do aprendizado é **reduzir erros e intervenção humana**, não aumentar indefinidamente o manual dos agentes.

## Métricas mínimas

Registrar por contrato:

- intervenções humanas;
- dúvidas iniciais e `PREFLIGHT_MISS`;
- reuniões durante execução;
- voltas por defeito de pedido/execução;
- regressões;
- débitos encontrados;
- scope drift bloqueado;
- duração;
- consumo de cota quando mensurável;
- custo API separado;
- qualidade/defeitos por role/model/runtime/effort;
- falhas escapadas após conclusão.

## Resultado

A retrospectiva termina com fatos preservados, candidatos de aprendizado e ações mensuráveis. Ela não reescreve o histórico para fazer a execução parecer melhor do que foi.