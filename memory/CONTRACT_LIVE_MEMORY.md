# Memória viva do contrato

A memória viva é o estado operacional canônico de um contrato em execução. Ela existe para que nenhuma sessão, modelo ou papel dependa de memória conversacional volátil.

## Princípio

**Contrato diz o destino. Mapa diz a rota. Memória viva diz onde estamos agora.**

Ela é atualizada durante a execução, mas não reescreve silenciosamente contrato, decisões do dono ou evidência histórica.

## Conteúdo mínimo

A memória viva deve expor, com versão/hash e proveniência quando aplicável:

- `contract_id` e versão/hash do contrato;
- objetivo/destino contratado;
- etapa atual do mapa;
- status de cada etapa: `pending | running | blocked | proven | rejected | superseded`;
- decisões do dono vigentes;
- perguntas abertas/resolvidas;
- reuniões realizadas e decisões válidas;
- adendos aprovados;
- achados e débitos registrados;
- baseline e superfícies de regressão;
- evidências produzidas;
- artefatos/commits/PRs ligados ao contrato;
- bloqueios atuais;
- próximo papel autorizado e por quê;
- configuração efetiva de routing/effort relevante;
- métricas acumuladas de execução.

## Append-only + snapshot

A verdade histórica fica em eventos append-only. A memória viva pode manter um snapshot materializado para leitura rápida, mas todo campo precisa ser reconstruível a partir do event log e dos artefatos canônicos.

Nunca apagar um fato histórico porque a conclusão mudou. Registre a nova conclusão e o que supersedeu a anterior.

## Quem pode escrever

Papéis não editam a memória canônica livremente.

- agentes emitem fatos, decisões propostas, evidências e eventos;
- o Orchestrator valida a transição semântica;
- o kernel aplica a transição permitida;
- o Scribe pode estruturar o registro, mas não alterar o significado;
- decisões reservadas ao dono só entram como decisão após origem autenticada.

## Leitura obrigatória

Antes de cada despacho, o PRE_DISPATCH injeta um snapshot mínimo da memória viva aplicável à etapa. O agente não escolhe se quer consultá-la.

O manifesto registra hash/versão do snapshot entregue.

## Dúvidas durante execução

Uma dúvida nova atualiza a memória viva imediatamente como bloqueio ou achado classificado. Se exigir debate, abre `MEETING_ROOM`. Se for lateral, vira débito. Se alterar destino, exige adendo aprovado ou novo contrato.

## Regra contra deriva

A memória viva nunca transforma descoberta lateral em objetivo ativo por simples proximidade técnica.

Mudança de rota pode entrar no mapa com justificativa. Mudança de destino exige autoridade do dono.

## Fechamento

No encerramento, a memória viva é congelada como snapshot final do contrato e passa a ser fonte para:

- Acceptance;
- retrospectiva;
- Supervisor;
- triagem de débitos;
- anti-regressão de execuções filhas futuras;
- auditoria/reprodução.