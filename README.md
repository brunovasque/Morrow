# Morrow

Codinome de laboratório para um **kernel autônomo de execução governada de contratos de software**.

O Morrow é um **control plane**: pode construir um repositório novo ou executar um contrato contra qualquer repositório-alvo autorizado sem precisar morar dentro dele.

## Estado

**Fase 1 — governança, preflight, memória e regressão antes do Runtime V0 executável.**

Ainda não é SaaS/plataforma final. O objetivo é provar que contratos pequenos podem ser executados ponta a ponta com cada vez menos intervenção humana, preservando segurança, escopo e comportamento já aceito.

## Princípios constitucionais

1. **Contrato define o destino; mapa define a rota; memória viva define o estado atual.**
2. Destino não muda por conveniência técnica. Mudança exige adendo aprovado ou novo contrato.
3. Papel != modelo != sessão != workspace != target.
4. Skills especializam papéis; não governam o kernel.
5. `quota-session`, `api` e `local` são modos de acesso nativos; API nunca é fallback silencioso.
6. Controle manual de runtime/modelo/effort é primeira classe. Automático só ganha autoridade após dados suficientes.
7. Rodada multiagente de dúvidas e mapa completo são pré-condições de execução.
8. Dúvida durante execução pode abrir uma sala de reunião governada com Orchestrator obrigatório.
9. Achado lateral não vira melhoria oportunista: passa por veto de scope drift e, se fora do contrato, vira débito.
10. Regressão de comportamento aceito é veto. Check obrigatório precisa ser **executado**, não apenas existir.
11. Débito posterior herda a anti-regressão do contrato-pai antes de poder fechar.
12. Reviewer e Auditor são responsabilidades independentes.
13. Memória institucional não depende de a sessão “lembrar”: contexto aplicável é injetado pelo kernel e provado por manifesto.
14. Aprendizado nasce de evidência/retrospectiva e só vira regra institucional após promoção governada.
15. Antes de reinventar infraestrutura/capability não trivial, pesquisar estado da arte e preferir padrão/biblioteca/adapter quando adequado.
16. Nenhum segredo, dado de cliente ou configuração proprietária de target precisa entrar no core público.

## Fluxo canônico

```text
objetivo humano
→ discovery/diagnóstico
→ rodada de dúvidas
→ respostas/decisões
→ mapa de execução
→ CONTRACT_PREFLIGHT
→ execução por etapas
→ prova + anti-regressão
→ Reviewer
→ Auditor conforme risco
→ Acceptance
→ triagem de débitos
→ retrospectiva independente + reunião coletiva
→ Supervisor/aprendizado
→ CONTRACT_CLOSE
```

As transições são governadas pela máquina de estados do kernel; um LLM não pode simplesmente pular etapa.

## Primeira prova

O primeiro marco executável será um contrato pequeno de software do começo ao fim e medirá, no mínimo:

- intervenções humanas;
- preflight misses;
- regressões;
- reuniões necessárias;
- voltas por erro;
- consumo de cota/custo API separado;
- qualidade final;
- aprendizado reaproveitado na rodada seguinte.