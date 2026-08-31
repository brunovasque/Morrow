# Multiplexing e cleanup ConPTY

- contract: `MORROW-MVO-001`
- PR-ID: `P3-PR04`
- estado: `GREEN_CANDIDATE`

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

Todos os eventos são conferidos contra a identidade esperada. Ao final, PIDs de host nativo, raiz e descendentes precisam ser distintos e inexistentes, e a raiz específica do probe precisa ser removível. Um deadline de 32 segundos tenta parar somente as sessões criadas pelo probe e encerra vermelho caso uma regressão nativa deixe o gate pendurado.

## Falha material e correção estrutural

O candidate `ff744d2` produziu inicialmente resultados verdes, mas eles foram invalidados durante a revisão remota. Repetições posteriores tiveram hard timeout em `input-completion`, e o dono observou a assertion nativa `remove_pty_baton(baton->id)` em `node-pty/src/win/conpty.cc:106`.

Na dependência fixada, `ptyHandles` é um vetor global do addon e cada thread de exit remove seu baton sem sincronização. Portanto duas sessões no mesmo processo compartilhavam estado nativo inseguro mesmo quando o manager limitava corretamente a capacidade. Os candidates anteriores `ff744d2`/`62b06ff` e suas provas permanecem invalidados.

A correção hospeda cada sessão ConPTY em um processo Morrow próprio e mantém somente proxy/multiplexing no processo do manager:

```text
TerminalSessionManager
  → WindowsConptyHostSession (proxy IPC)
  → um windows-conpty-native-host.ts por sessão
  → uma única NativeWindowsConptyTerminalSession / addon node-pty por host
  → launcher + Job Object + comando e descendentes da sessão
```

O factory nativo recusa uso fora do entrypoint conectado do host. O proxy valida mensagens plain com campos exatos, confirma que o PID anunciado é o PID real do child e não publica exit antes do fechamento físico do host. Writes possuem fila própria, de modo que drain pendente não bloqueia stop fatal. Output e exit mantêm ordem pelo canal IPC.

A contraprova encerrou simultaneamente duas sessões em hosts distintos sem assertion e com todos os PIDs mortos ao concluir. Outro teste encerrou deliberadamente somente o host Morrow conhecido: o manager permaneceu vivo, recebeu falha controlada e o Job Object eliminou terminal e descendente. O backend passou `10/10`, a suíte `163/163` e o soak passou 3 rodadas/12 sessões/12 hosts distintos com `noOrphans=true` e fixture removida.

As execuções desta unidade não usaram credencial exportada, API, rede de produto, Enova, target externo, diretório de projeto do operador ou terminal do operador.

## Limites

- a capacidade dois é o teto medido do MVO e está `GREEN_CANDIDATE`; integração ainda exige revisão do head remoto exato;
- aumentar esse teto exige novo probe real, soak repetido e revisão da dependência nativa;
- ConPTY/Job Object fornecem ciclo de vida e contenção da árvore, não sandbox geral do sistema;
- persistência, redaction, replay e API de múltiplas sessões pertencem à P4;
- panes/tabs e controles visuais pertencem à P5;
- esta prova não declara o Morrow operacional.
