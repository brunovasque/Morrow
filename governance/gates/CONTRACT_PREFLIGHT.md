# Gate CONTRACT_PREFLIGHT

Nenhum trabalho de escrita começa antes de o contrato estar preparado para execução autônoma.

## Exigências mínimas

1. objetivo e estado-alvo observável definidos;
2. critérios de aceitação verificáveis;
3. exclusões e invariantes explícitos;
4. target descriptor resolvido;
5. baseline/regression profile identificado quando aplicável;
6. rodada independente de dúvidas por todos os papéis selecionados;
7. segunda passagem adversarial de completude;
8. zero pergunta bloqueante aberta;
9. mapa de execução cobrindo todos os deliverables;
10. papel, entrada, saída, método, evidência e gate de cada etapa definidos;
11. decisões do dono necessárias registradas;
12. pesquisa de estado da arte concluída quando a etapa cria capability/infraestrutura não trivial;
13. routing/access/effort válidos para os papéis necessários;
14. memória institucional promovida aplicável resolvida;
15. risco e necessidade de Reviewer/Auditor/Security/Acceptance classificados.

## Rodada de dúvidas

A simples ausência de perguntas não prova completude. Cada papel deve declarar quais superfícies revisou. O Orchestrator só fecha a rodada depois da segunda passagem adversarial.

Dúvida factual deve ser respondida por evidência quando possível; dúvida de intenção/autoridade vai ao dono.

## Saída determinística

O gate retorna:

- `READY_FOR_EXECUTION`;
- ou `BLOCKED`, com lista estruturada de requisitos faltantes.

Um LLM não pode sobrescrever `BLOCKED` por confiança, pressa ou consenso.

## Aprendizado

Pergunta razoavelmente previsível que surge durante execução vira `PREFLIGHT_MISS` e alimenta retrospectiva, mapa de erros e possível nova cerca/checklist.