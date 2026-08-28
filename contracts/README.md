# Contratos no Morrow

Um contrato não é um único arquivo. É um conjunto governado de artefatos com responsabilidades distintas.

## Artefatos canônicos

- `CONTRACT.md` — destino, critérios, exclusões, invariantes e decisões do dono;
- `TARGET.md` — alvo, acesso, baseline e políticas específicas;
- `QUESTIONS.md` — rodada de dúvidas, respostas e falhas de preflight;
- `MAP.md` — rota de execução, papéis, entradas, saídas, provas e regressão;
- `ADDENDA.md` — mudanças de destino autorizadas sem apagar o contrato original;
- `DEBTS.md` — achados laterais, bloqueios e dívidas deferidas;
- memória viva — snapshot operacional materializado a partir de eventos/artefatos;
- event log — histórico append-only das transições, reuniões, decisões e despachos.

## Separação de responsabilidades

**Contrato não muda para acompanhar a execução.**

- destino mudou → adendo/novo contrato;
- rota mudou → mapa;
- dúvida apareceu → QUESTIONS / reunião;
- estado atual mudou → memória viva/event log;
- achado fora do objetivo → DEBTS;
- comportamento aceito precisa sobreviver → regression manifest/gates.

## Regra de execução

Nenhum agente recebe apenas um prompt solto dizendo "faça o contrato". O kernel resolve o estado canônico, gera um PRE_DISPATCH manifesto e entrega somente a etapa autorizada.

## Fechamento

Contrato fechado congela um snapshot final com critérios, invariantes, regressão, Acceptance e débitos deferidos. Esse snapshot é herdado por futuras execuções filhas para impedir que o fechamento de um débito regrida o que já foi entregue.