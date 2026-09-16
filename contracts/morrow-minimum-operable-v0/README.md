# Morrow Minimum Operable V0 — pacote contratual

Este diretório é a fonte canônica para concluir o primeiro Morrow capaz de operar contratos reais dentro de um envelope mínimo e explícito.

## Protocolo obrigatório de retomada

Qualquer nova aba, agente ou sessão que continue este trabalho deve, antes de propor ou alterar código:

1. confirmar o repositório `brunovasque/Morrow` e a branch/base autorizada;
2. ler integralmente, nesta ordem:
   1. [`CONTRACT.md`](CONTRACT.md);
   2. [`ADDENDA.md`](ADDENDA.md);
   3. [`TARGET.md`](TARGET.md);
   4. [`QUESTIONS.md`](QUESTIONS.md);
   5. [`MAP.md`](MAP.md);
   6. [`PRS.md`](PRS.md);
   7. [`LIVE_STATUS.md`](LIVE_STATUS.md);
   8. [`EVIDENCE.md`](EVIDENCE.md);
   9. [`DEBTS.md`](DEBTS.md);
   10. [`TRACEABILITY.md`](TRACEABILITY.md);
3. reconciliar `LIVE_STATUS.md` com Git/Event Log; divergência bloqueia dispatch;
4. executar somente o `next_authorized_action` registrado;
5. aplicar CONTRACT_PREFLIGHT/PRE_DISPATCH e as cercas de regressão cabíveis;
6. atualizar evidência e estado vivo no mesmo ciclo da mudança;
7. registrar mudança de destino em `ADDENDA.md`, mudança de rota em `MAP.md` e achado lateral em `DEBTS.md`.

Conversa anterior é contexto auxiliar. Ela não substitui estes artefatos.

## Artefatos

- `CONTRACT.md` — destino imutável, envelope mínimo, aceitação, exclusões e decisões do dono;
- `TARGET.md` — repositório autorizado, baseline, políticas e isolamento;
- `QUESTIONS.md` — dúvidas, respostas e passes de completude;
- `MAP.md` — fases, dependências, gates e rota adaptativa;
- `PRS.md` — unidades pequenas de entrega, objetivo e prova de cada PR;
- `LIVE_STATUS.md` — posição atual e próximo passo autorizado;
- `EVIDENCE.md` — commits, PRs, testes, reviews e provas;
- `TRACEABILITY.md` — requisito → cláusula → fase/PR → aceite;
- `ADDENDA.md` — mudanças de destino aprovadas;
- `DEBTS.md` — exclusões e achados laterais deferidos.
- `reviews/` — revisão e contraprovas de cada unidade contratual concluída.

## Regra de autoridade

Em caso de conflito:

```text
CONTRACT + ADDENDA aprovados
  > decisões autenticadas do dono
  > TARGET / invariantes / gates
  > MAP / PRS
  > LIVE_STATUS / EVIDENCE
  > conversa, resumo ou memória de sessão
```

Nenhuma aba pode continuar “de cabeça”.
