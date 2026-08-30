# ADR — backend de terminal real no Windows

- status: `IMPLEMENTED_AND_PROVEN_P3_PR02`
- contract: `MORROW-MVO-001`
- decision owner: técnica de rota; não muda o destino aprovado
- decision date: `2026-08-29`
- decision scope: `P3-PR01`
- implementation scope: `P3-PR02`

## Contexto

O Morrow já possui sessões `process-pipes` isoladas, simultâneas e observáveis. Elas servem para automação, fixtures e processos que aceitam `stdin/stdout/stderr`, mas não preservam toda a semântica de um terminal Windows. O contrato exige ConPTY real para input interativo, resize, interrupção, UTF-8/VT, exit status e apresentação na interface.

Esta decisão precisa manter duas verdades separadas:

1. `process-pipes` continua útil e não deve regredir;
2. somente um backend que prove todas as capabilities de terminal pode ser apresentado como `full-terminal`.

P3-PR01 define a fronteira e escolhe o candidato. Ela não instala uma dependência nativa nem afirma que ConPTY já funciona. A prova interativa real pertence à P3-PR02.

## Evidência de estado da arte

Fontes primárias consultadas em 2026-08-29:

- [Microsoft Learn — Creating a Pseudoconsole Session](https://learn.microsoft.com/windows/console/creating-a-pseudoconsole-session): criação exige canais bidirecionais, `HPCON`, `STARTUPINFOEX`, `PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE`, `CreateProcessW`, drenagem concorrente, resize e teardown cuidadoso;
- [Microsoft Learn — CreatePseudoConsole](https://learn.microsoft.com/windows/console/createpseudoconsole): Windows 10 1809/Server 2019 são o mínimo da API; input/output são UTF-8 com texto e sequências VT intercaladas;
- [Windows Terminal — amostras ConPTY](https://github.com/microsoft/terminal/tree/main/samples/ConPTY): referência nativa oficial para pipes, criação, processo e fechamento;
- [microsoft/node-pty](https://github.com/microsoft/node-pty): adapter Node usado por terminais reais, incluindo VS Code, com `spawn`, `onData`, `onExit`, `write`, `resize`, `clear`, pause/resume e backend ConPTY no Windows;
- [node-pty v1.1.0](https://github.com/microsoft/node-pty/releases/tag/v1.1.0): release estável mais recente observada, com prebuilds e correções de escrita/handles/ConPTY;
- [npm — node-pty versions](https://www.npmjs.com/package/node-pty?activeTab=versions): tag `latest` observada em `1.1.0`; linha `1.2.0` ainda beta;
- [VS Code — package.json](https://github.com/microsoft/vscode/blob/main/package.json): consumo real atual da linha `1.2.0-beta` confirma uso ativo, mas não transforma prerelease em escolha segura para o MVO;
- [node-pty #955](https://github.com/microsoft/node-pty/issues/955): regressão Windows aberta observada em `1.2.0-beta.15`, na qual a sessão persistente pode encerrar antes da primeira escrita; o mesmo smoke reporta passagem em `1.1.0`.

### Medição do ambiente de desenvolvimento

| item | valor medido |
|---|---|
| Windows | build `19045`, x64 |
| `conhost.exe` | `10.0.19041.4522` |
| PowerShell | `7.6.4`, Core |
| Node | `24.14.1`, x64 |
| baseline Morrow | `06e2a4c`; `130/130` testes pós-merge |

O build medido supera o gate conservador `18309` usado pelo `node-pty` para ConPTY. Compatibilidade binária e comportamento com Node 24 ainda precisam ser provados pela P3-PR02; documentação ou disponibilidade da API não substituem esse teste.

## Alternativas medidas

| alternativa | aderência | riscos/limites | decisão |
|---|---|---|---|
| Win32 ConPTY direto em addon/sidecar próprio | controle completo e API oficial | amplia C++/Win32, empacotamento, handles, threads, deadlock e manutenção próprios | reserva; somente se o adapter escolhido falhar e este ADR for reaberto |
| `node-pty` estável `1.1.0` sobre ConPTY do sistema | interface Node estreita, prebuilds, uso amplo, PID/input/resize/exit expostos | addon nativo; instalação e Node 24 precisam de prova; não é thread-safe; roda com privilégio do Worker | candidato escolhido, fixado exatamente e atrás da interface Morrow |
| `node-pty` `1.2.0-beta.15` | linha mais nova e usada pelo VS Code atual | prerelease e regressão Windows persistente aberta em 2026-08-29 | rejeitado para o MVO atual |
| `winpty` | compatibilidade histórica com Windows antigos | não é ConPTY do sistema e foi removido da linha nova do `node-pty` | rejeitado; nenhum fallback silencioso |
| `process-pipes` | já provado, simples, separa stdout/stderr | sem TTY, resize ou interrupção de terminal | preservado somente como `process-output` |

## Decisão

1. A API nativa de destino é **Windows ConPTY**.
2. O primeiro adapter de implementação da P3-PR02 será **`node-pty` `1.1.0` fixado exatamente**, carregado apenas pelo Local Worker e sempre atrás da interface `TerminalBackend` do Morrow.
3. No Windows, a configuração deve exigir ConPTY do sistema (`useConpty: true`, `useConptyDll: false`). `winpty` ou DLL ConPTY empacotada não podem aparecer como fallback silencioso.
4. Falha de import, prebuild, versão do Windows, arquitetura ou probe torna o backend `unavailable`; não promove `process-pipes` a terminal real.
5. A linha beta não entra enquanto houver regressão aberta relevante. Upgrade exige repetir o probe e atualizar a evidência deste ADR.
6. O backend nativo não será chamado diretamente por UI, Orchestrator ou adapter de modelo. Somente o `TerminalSessionManager` usa a interface estreita.
7. Uma instância Node/Worker governa as sessões do adapter; não se distribui `node-pty` por `worker_threads`, pois o próprio projeto declara ausência de thread safety.

## Interface e capability gate

`src/terminal-backend.ts` define:

- identidade imutável: `kind`, `implementationId` e `protocol`;
- capabilities explícitas: `tty`, `interactive`, `resize`, `signals`, `utf8`, `exitStatus`;
- ciclo mínimo sem janela cega: `create` inerte, registro de todos os observers, `start`, started/output/error/exit, `write`, backpressure, end input, `resize`, `interrupt` e `stop`;
- protocolos distintos: `separate-pipes` e `conpty-vt`;
- apresentação calculada: `process-output` ou `full-terminal`.

Nesta versão da interface, `signals: true` significa que o backend implementa os dois
interrupts declarados (`ctrl-c` e `ctrl-break`). Se o probe provar apenas um deles,
a capability permanece falsa e a apresentação não pode subir para `full-terminal`.

`full-terminal` somente é permitido quando:

```text
kind == windows-conpty
and protocol == conpty-vt
and tty && interactive && resize && signals && utf8 && exitStatus
```

Qualquer capability ausente produz `process-output` e uma lista mecânica do que falta. A UI futura consome essa projeção; não decide por nome, texto ou aparência do stream.

O backend padrão permanece `ProcessPipesTerminalBackend`. Seu perfil é validado estritamente e não pode alegar TTY, resize ou sinais. A sessão registra backend, implementação, protocolo, capabilities e apresentação junto da identidade já existente.

`create()` não pode iniciar o processo nem invocar callbacks. O manager registra started,
output, error e exit antes de chamar `start()`. Essa ordem é parte da interface porque um
PTY pode produzir prompt/VT imediatamente; conectar o observer depois do spawn abriria
uma janela de perda justamente no começo da sessão. Além disso, `separate-pipes` aceita
somente `stdout/stderr`, enquanto `conpty-vt` aceita somente o stream combinado `terminal`.
Violação de protocolo ou erro fatal falha fechada e força o encerramento da sessão.

## Gate obrigatório da P3-PR02

Antes de declarar o adapter ConPTY aceito, a P3-PR02 precisa provar em Windows real:

1. build `>= 18309`, x64 e `CreatePseudoConsole` disponíveis;
2. instalação reproduzível do pacote fixado, preferencialmente por prebuild; necessidade de toolchain vira requisito explícito de bootstrap;
3. import no Node suportado e recusa clara em plataforma/arquitetura incompatível;
4. PowerShell persistente recebe duas escritas separadas e preserva estado entre elas;
5. observers são ligados antes do start e nenhum byte inicial/prompt se perde, inclusive quando a fixture emite sincronicamente;
6. `cwd`, workspace, contrato, agente, runtime e PID permanecem os vinculados pelo Morrow;
7. saída incremental UTF-8 com caracteres não ASCII e sequências VT chega somente pelo stream `terminal`, sem transcodificação indevida;
8. resize altera as dimensões observáveis pela aplicação hospedada;
9. interrupção de foreground por `Ctrl+C` e `Ctrl+Break` tem resultado distinguível de stop/timeout; incapacidade em qualquer uma mantém `signals: false`;
10. exit status correto em sucesso e falha;
11. teardown continua drenando output e não entra no deadlock advertido pela Microsoft;
12. nenhum processo/handle fica órfão após stop, timeout, erro fatal ou falha de startup;
13. `process-pipes` continua verde e continua rotulado somente como `process-output`.

Se `node-pty` `1.1.0` falhar em Node 24/build suportado e não houver correção pequena e reproduzível, P3-PR02 retorna a este ADR. Um addon/sidecar próprio ou outra versão só entra com comparação nova; a rota não pode simplesmente aceitar o beta conhecido como regressivo.

## Segurança e isolamento

- o processo ConPTY herda o nível de privilégio do Local Worker; ConPTY não é sandbox;
- comando/args, cwd, env e target continuam vindo do dispatch governado e workspace validado;
- terminal do operador nunca é anexado, adotado ou encerrado;
- VT/output é dado não confiável para a UI; redaction e persistência pertencem à P4;
- input sensível não entra no Event Log; somente contagem/metadados mecânicos existentes;
- tamanho, interrupção e stop são endereçados pelo `terminal_session_id`, não por pane visual;
- fechamento precisa drenar output concorrentemente, conforme alerta oficial de deadlock;
- process tree/Job Object, soak e colisões permanecem gates da P3-PR02/P3-PR04, não promessas desta PR.

## Consequências

- a UI não poderá confundir saída de automação com terminal real;
- o core fica substituível: trocar o adapter não muda `TerminalSessionManager` nem o contrato da UI;
- P3-PR02 fica pequena e verificável: implementar um backend já cercado, sem refatorar toda a sessão junto;
- o Morrow aceita custo de uma dependência nativa fixada, mas não aceita prerelease regressiva nem fallback não rotulado;
- P3-PR01 não declarou capacidade ConPTY provada; a medição posterior da P3-PR02 fica registrada abaixo e ainda depende da revisão do candidate.

## Resultado medido pela P3-PR02

Em 2026-08-30, o probe da P3-PR02 instalou `node-pty` `1.1.0` exato pelos prebuilds `win32-x64` e importou o addon no Node `24.14.1`. A execução real provou Windows PowerShell persistente em perfil temporário controlado, estado entre escritas, output inicial observado, UTF-8, VT, resize `101x37`, `Ctrl+C`, `Ctrl+Break`, exit code não zero, 512 KiB de tail drenado e encerramento do processo de prova.

Quatro limites reais do adapter e da integração foram encontrados e cercados sem mudar a versão aprovada:

1. a API pública escreve ETX para `Ctrl+C`, mas não expõe `Ctrl+Break`; o backend usa um auxiliar interno absoluto que se conecta apenas ao pseudoconsole da sessão e emite `CTRL_BREAK_EVENT`;
2. após saída natural, a versão fixa pode manter seu worker de drenagem vivo; o backend valida o hook interno exato antes de liberar o comando e aguarda sua terminação somente depois do evento pós-flush;
3. o exit público podia anteceder o fechamento de Job Controller/helpers e a liberação do cwd; o backend agora publica exit apenas depois desses handles e a prova remove a raiz temporária imediatamente;
4. ambiente herdado e busca em PATH podiam cruzar estado do operador; o target recebe somente `env` governado, helpers usam Windows PowerShell absoluto do sistema e as provas redirecionam o perfil à fixture.

Para limitar stop e falhas ao processo correto, o comando não nasce solto: um launcher inerte é atribuído primeiro a um Job Object próprio com `KILL_ON_JOB_CLOSE`, e somente então cria o comando governado. A prova cria um descendente de longa duração e confirma que ele desaparece junto da sessão. Nenhum processo do console do operador é enumerado ou adotado.

O candidate P3-PR02 mantém `useConpty: true`, `useConptyDll: false` e não introduz fallback. O diff remoto inicial recebeu revisão adversarial, as correções passaram probe `5/5` e suíte `149/149`, e o head remoto corrigido `c32fcb1` foi revalidado `MERGEABLE/CLEAN`. Esta ADR está provada para P3-PR02; qualquer upgrade da versão fixa reabre o gate. Os detalhes estão em `WINDOWS_CONPTY_BACKEND.md`.
