# Multiplexing e cleanup ConPTY

## Escopo

A P3-PR04 fecha a prova mínima de múltiplas sessões Windows ConPTY reais. O `TerminalSessionManager` mantém cada sessão vinculada a um `terminal_session_id`, `agent_instance_id`, papel, runtime e workspace próprios; input, timeout, cancel e resultado continuam endereçados pela identidade da sessão, sem anexar terminais do operador.

## Reserva e colisões

`start()` valida o workspace no filesystem e depois repete as verificações lógicas antes de criar o backend. Essa segunda barreira é obrigatória porque a resolução canônica do workspace contém `await`: sem ela, duas chamadas concorrentes podiam atravessar juntas o primeiro teste e reservar a mesma identidade.

Enquanto uma sessão está ativa, o manager recusa mecanicamente:

- `terminal_session_id` já registrado;
- `agent_instance_id` já ativo;
- raiz canônica de workspace já ativa;
- nova sessão acima da capacidade configurada.

O backend processual preserva a concorrência anterior e só recebe teto quando a composição o configura. No backend Windows ConPTY do MVO, a capacidade comprovada é duas sessões simultâneas e valores maiores falham na construção. A exploração adversarial com quatro sessões concorrentes expôs instabilidade nativa no conjunto medido `node-pty 1.1.0`/Windows, incluindo término `0xC0000005`; o MVO não transforma essa faixa não provada em promessa silenciosa.

## Probe real

`npm run probe:conpty-soak` usa exclusivamente fixtures sob `.morrow-test-tmp` no próprio repositório. Em três rodadas, ele cria doze workspaces e sessões reais:

- duas sessões de input simultâneas por rodada, com tokens exclusivos e contraprova de cruzamento;
- uma sessão encerrada por timeout e outra por cancel simultaneamente;
- um processo descendente em cada sessão;
- quatro recusas por rodada: terminal, agente, workspace e capacidade.

Todos os eventos são conferidos contra a identidade esperada. Ao final, PIDs de raiz e descendentes precisam ser distintos e inexistentes, e a raiz específica do probe precisa ser removível. Um deadline de 32 segundos tenta parar somente as sessões criadas pelo probe e encerra vermelho caso uma regressão nativa deixe o gate pendurado.

## Evidência invalidada e correção requerida

O candidate `ff744d2` produziu inicialmente resultados verdes, mas eles foram invalidados durante a revisão remota. Repetições posteriores tiveram hard timeout em `input-completion`, e o dono observou a assertion nativa `remove_pty_baton(baton->id)` em `node-pty/src/win/conpty.cc:106`.

Na dependência fixada, `ptyHandles` é um vetor global do addon e cada thread de exit remove seu baton sem sincronização. Portanto duas sessões no mesmo processo compartilham estado nativo inseguro mesmo quando o manager limita corretamente a capacidade. A correção desta PR deve hospedar cada sessão ConPTY em processo Morrow próprio e manter somente o proxy/multiplexing no processo do manager. As provas anteriores não podem ser usadas para `PROVEN`.

As execuções desta unidade não usaram credencial exportada, API, rede de produto, Enova, target externo, diretório de projeto do operador ou terminal do operador.

## Limites

- a capacidade dois continua sendo o objetivo mínimo, mas não está comprovada enquanto duas sessões compartilharem o addon no mesmo processo;
- aumentar esse teto exige novo probe real, soak repetido e revisão da dependência nativa;
- ConPTY/Job Object fornecem ciclo de vida e contenção da árvore, não sandbox geral do sistema;
- persistência, redaction, replay e API de múltiplas sessões pertencem à P4;
- panes/tabs e controles visuais pertencem à P5;
- esta prova não declara o Morrow operacional.
