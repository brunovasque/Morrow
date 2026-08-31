# Backend Windows ConPTY — P3-PR02

- contract: `MORROW-MVO-001`
- PR-ID: `P3-PR02`
- estado: `GREEN`
- base: `6168adebeac7fdeb1620e22785eee99b51b17b25`
- ambiente host medido: Windows build `19045` x64, Node `24.14.1`, PowerShell `7.6.4`

## Resultado

O Morrow possui um backend real `windows-conpty`, atrás da interface aprovada em P3-PR01. Ele usa `node-pty` `1.1.0` fixado exatamente, `useConpty: true` e `useConptyDll: false`. Não existe fallback para pipes, winpty, DLL empacotada ou versão beta.

O descritor só libera `full-terminal` porque a prova Windows mediu todas as capabilities exigidas: TTY, input persistente, resize, `Ctrl+C`, `Ctrl+Break`, UTF-8, VT e exit status. `process-pipes` permanece separado e continua sendo apenas `process-output`.

## Sequência sem janela cega

```text
manager registra observers
  → start cria ConPTY com launcher inerte
  → Job Object recebe o launcher
  → backend libera o launcher
  → launcher cria o comando governado dentro do mesmo console/job
  → output sai apenas no stream terminal
```

O launcher não executa string de shell. Comando e argumentos são um objeto fechado, codificado para transporte e entregue a `spawn(..., shell: false)`. O launcher/comando recebe somente o ambiente explicitamente resolvido pelo dispatch; não existe mescla implícita com `process.env`. Os auxiliares usam o Windows PowerShell absoluto do sistema e ambiente mínimo sem PATH nem variáveis de dispatch.

## Isolamento e encerramento

Cada sessão cria um Job Object próprio com `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. O comando real só é liberado depois que o launcher foi atribuído ao job. Stop, falha do controlador, fechamento do Worker ou fim natural fecham o handle do job e eliminam descendentes presos àquela sessão.

Após o achado material da P3-PR04 no estado global de `node-pty 1.1.0`, cada sessão nativa também passou a viver em processo host Morrow próprio. O manager mantém somente um proxy IPC por sessão; assim duas sessões simultâneas não compartilham o vetor global `ptyHandles` do addon. Se um host falhar, seu Job Object elimina apenas a árvore gerenciada daquela sessão e o manager recebe falha controlada sem adotar ou encerrar processos externos.

O teste cria deliberadamente um processo Node descendente de longa duração, para a sessão e confirma fora do processo que o descendente não existe mais. Nenhum PID do operador é enumerado, adotado ou encerrado; o terminal local do operador continua completamente separado.

## Interrupções

- `Ctrl+C`: ETX (`0x03`) é escrito no input ConPTY, conforme a amostra oficial da Microsoft;
- `Ctrl+Break`: um auxiliar absoluto e interno se conecta somente ao console identificado pelo PID raiz da sessão e emite `CTRL_BREAK_EVENT`; o auxiliar ignora seu próprio evento e se desconecta em seguida;
- stop/timeout: não são mascarados como interrupção; fecham o Job Object da sessão.

O adapter `node-pty` não expõe `Ctrl+Break` em sua API pública. Essa diferença fica cercada no backend Morrow e é provada com uma fixture .NET que distingue `ControlC` de `ControlBreak`.

## Drenagem e compatibilidade fixada

No Windows, `node-pty` `1.1.0` mantém um worker de drenagem interno. Após a saída natural, o backend espera o evento público — que ocorre depois do flush do socket — e aguarda a terminação do worker residual, do Job Controller e dos helpers antes de publicar exit ao manager. A forma interna é validada antes de liberar o comando; drift falha fechado. Mesmo se a validação pós-spawn recusar a versão, observers já estão ativos e a reserva do workspace permanece até a saída física.

O child-probe confirma simultaneamente:

- 512 KiB de tail mais marker final recebidos antes do exit;
- exit code `7` preservado;
- raiz temporária removível imediatamente após `onExit`, sem worker/handle vivo;
- stop elimina o processo raiz e seu descendente.

## Fronteiras

- ConPTY é isolamento de terminal/process tree, não sandbox de segurança;
- comando, cwd, env e autoridade continuam vindo do dispatch e workspace governados;
- ambiente e perfil do operador não são herdados implicitamente; as provas usam perfil sob raiz temporária controlada;
- UI, transcript, redaction e persistência de terminal pertencem a P4/P5;
- Codex quota-session dentro deste backend pertence a P3-PR03;
- o soak de múltiplas sessões, colisões e cleanup foi fechado em P3-PR04 e está documentado em `CONPTY_MULTIPLEXING.md`;
- este backend ainda não é o padrão global; a composição é explícita por `TerminalSessionManager`.

Nenhuma credencial real, rede de produto, Enova ou target externo foi usado na prova.
