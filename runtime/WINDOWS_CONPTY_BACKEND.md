# Backend Windows ConPTY — P3-PR02

- contract: `MORROW-MVO-001`
- PR-ID: `P3-PR02`
- estado: `GREEN_CANDIDATE`
- base: `6168adebeac7fdeb1620e22785eee99b51b17b25`
- ambiente provado: Windows build `19045` x64, Node `24.14.1`, PowerShell `7.6.4`

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

O launcher não executa string de shell. Comando e argumentos são um objeto fechado, codificado para transporte e entregue a `spawn(..., shell: false)`. O ambiente do target é herdado apenas pelo launcher/comando governado; os auxiliares de controle recebem um ambiente mínimo sem variáveis de dispatch.

## Isolamento e encerramento

Cada sessão cria um Job Object próprio com `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. O comando real só é liberado depois que o launcher foi atribuído ao job. Stop, falha do controlador, fechamento do Worker ou fim natural fecham o handle do job e eliminam descendentes presos àquela sessão.

O teste cria deliberadamente um PowerShell filho de longa duração, para a sessão e confirma fora do processo que o descendente não existe mais. Nenhum PID do operador é enumerado, adotado ou encerrado; o terminal local do operador continua completamente separado.

## Interrupções

- `Ctrl+C`: ETX (`0x03`) é escrito no input ConPTY, conforme a amostra oficial da Microsoft;
- `Ctrl+Break`: um auxiliar absoluto e interno se conecta somente ao console identificado pelo PID raiz da sessão e emite `CTRL_BREAK_EVENT`; o auxiliar ignora seu próprio evento e se desconecta em seguida;
- stop/timeout: não são mascarados como interrupção; fecham o Job Object da sessão.

O adapter `node-pty` não expõe `Ctrl+Break` em sua API pública. Essa diferença fica cercada no backend Morrow e é provada com uma fixture .NET que distingue `ControlC` de `ControlBreak`.

## Drenagem e compatibilidade fixada

No Windows, `node-pty` `1.1.0` mantém um worker de drenagem interno. Após a saída natural, o backend espera o evento de saída — que ocorre depois do flush do socket — e aciona explicitamente o hook de descarte dessa versão. A forma interna é validada antes de liberar o comando; drift falha fechado.

O child-probe confirma simultaneamente:

- tail final recebido antes do exit;
- exit code `7` preservado;
- processo de teste encerra sozinho, sem worker/handle vivo;
- stop elimina o processo raiz e seu descendente.

## Fronteiras

- ConPTY é isolamento de terminal/process tree, não sandbox de segurança;
- comando, cwd, env e autoridade continuam vindo do dispatch e workspace governados;
- UI, transcript, redaction e persistência de terminal pertencem a P4/P5;
- Codex quota-session dentro deste backend pertence a P3-PR03;
- soak de múltiplas sessões e colisões pertence a P3-PR04;
- este backend ainda não é o padrão global; a composição é explícita por `TerminalSessionManager`.

Nenhuma credencial real, rede de produto, Enova ou target externo foi usado na prova.
