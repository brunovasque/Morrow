# Recuperação durável do Local Worker — P2-PR06

- contrato: `MORROW-MVO-001`
- etapa: `P2-PR06`
- implementação: [`../src/worker-recovery.ts`](../src/worker-recovery.ts)
- provas: [`../test/worker-recovery.test.ts`](../test/worker-recovery.test.ts)

## Objetivo

P2-PR06 torna explícito o que acontece quando o PC ou o processo local fica indisponível. Trabalho autenticado pode aguardar numa fila durável, mas só entra em execução depois de `worker.hello` e de um `worker.heartbeat` autenticado, com status `ready` e lease ainda válido. PC desligado, Worker parado ou heartbeat vencido significam `offline`; nenhum executor é chamado nesse estado. `busy` e `draining` renovam liveness, mas não retiram trabalho novo da fila.

O coordenador não é um transporte de rede e não aceita comando, script, prompt, credencial ou prova de segurança para persistência. Ele fica entre o protocolo autenticado da P2-PR01 e a tentativa governada da P2-PR05. O transporte futuro entrega mensagens brutas e um contexto autenticado confiável; a composição cria, para cada tentativa, uma nova mensagem autenticada com o mesmo `idempotencyKey`.

## Estados observáveis

Conectividade:

- `offline`: não há lease confiável; trabalho novo permanece em fila;
- `connecting`: `worker.hello` foi aceito, mas ainda falta heartbeat válido;
- `online`: heartbeat autenticado e lease futuro permitem drenar a fila.

Dispatch:

- `queued`: efeito ainda não começou e pode retomar com segurança;
- `running`: checkpoint durável foi gravado antes da fronteira de efeito;
- `completed`: resumo terminal durável confirma conclusão;
- `failed`: o executor devolveu falha terminal conhecida;
- `blocked`: o efeito não pode ser retomado automaticamente, com causa explícita.

`inspect()` expõe identidade do Worker/sessão, lease, causa da conectividade, revisão e o estado de cada dispatch. Eventos canônicos, transcript, redaction e projeção para a interface pertencem a P4; esta PR não antecipa essas garantias.

## Ordem mecânica

```text
control.dispatch bruto
  -> validação worker-control/1.0 + identidade/autorização
  -> fingerprint do corpo governado
  -> recusa de rebinding de dispatchId/idempotencyKey
  -> checkpoint atômico queued
  -> aguarda hello + heartbeat autenticados
  -> checkpoint atômico running + attemptId + workerSessionId
  -> fronteira de tentativa governada P2-PR05
  -> checkpoint completed/failed/blocked ou retorno seguro a queued
```

O snapshot `worker-recovery-v1.json` fica sob uma raiz absoluta que contém `.morrow`. Escrita usa arquivo exclusivo temporário, sincronização e rename; leitura verifica o tamanho antes de carregar e recusa arquivo simbólico, JSON malformado, shape desconhecido, capacidade excedida, fingerprint divergente ou checksum incorreto. A raiz também recusa ancestrais simbólicos antes de criar arquivos.

A janela de replay faz parte do mesmo checkpoint atômico. Ela persiste somente hashes SHA-256 de `messageId` e nonce, expiração e último `sequence` por escopo autenticado; o valor do nonce, proof, credential e envelope não são gravados. Entradas ainda válidas e sequências não sofrem evicção silenciosa: capacidade esgotada falha antes do efeito. Assim restart não apaga `REPLAY_DETECTED`/`OUT_OF_ORDER`, e retry legítimo precisa conservar `idempotencyKey` enquanto usa novo message ID, nonce, prova e sequência crescente.

Uma lease `worker-recovery-v1.lock` dá posse da raiz a um único coordenador. Outra instância viva é recusada antes de ler/mutar o estado. Se o processo dono morreu, a próxima instância remove apenas a lease cujo PID já não existe e assume a raiz; lease malformada falha fechada. `close()` impede novos aceites, espera operações já admitidas e mutações pendentes, e somente então libera a posse. Assim uma validação assíncrona não pode escrever depois que outro coordenador assumiu a raiz.

## Idempotência e retry

O registro durável preserva `dispatchId`, `idempotencyKey`, fingerprint e somente o `ControlDispatchBody` já validado. Um retry com a mesma chave e mesmo corpo retorna o estado existente; a mesma chave ou o mesmo dispatch ligados a outro corpo são recusados. A capacidade é finita e nunca remove histórico para abrir espaço, pois evict poderia repetir um efeito antigo.

Retorno automático a `queued` só ocorre para recusas declaradas como anteriores ao efeito:

- `WORKER_NOT_READY`;
- `LOCK_UNAVAILABLE`;
- `QUOTA_REJECTED`;
- `BUDGET_REJECTED`.

Exceção na fronteira, resultado estruturalmente inválido, divergência do `idempotencyKey` devolvido, perda de sessão/lease durante `running` ou outro resultado incerto viram `blocked`. A lease é conferida novamente no settlement; uma renovação que chega depois de um intervalo vencido não apaga a perda, exige reconexão e bloqueia o efeito em curso. Heartbeat precisa informar exatamente os dispatches `running` conhecidos. O sistema não transforma incerteza em retry. Enquanto existir resultado desconhecido, novos dispatches do mesmo target permanecem `queued:target_blocked_by_unknown_outcome`; outro efeito não pode atravessar uma superfície cujo estado ficou incerto.

## Regra de kill/restart

Antes de chamar a tentativa, o coordenador persiste `running`. Se o processo morrer depois de produzir o efeito e antes de persistir a conclusão, o próximo `open()` converte esse registro em:

```text
status = blocked
reason = execution_outcome_unknown_after_restart
```

Ele não chama novamente o executor. Essa escolha pode exigir investigação ou reconciliação manual, mas impede que restart duplique um efeito que talvez já tenha ocorrido.

Já um registro `queued` prova que a fronteira de efeito não foi cruzada. Após restart ele continua em fila e só retoma quando uma nova sessão anuncia `hello` e depois heartbeat autenticado. Um registro `completed` continua terminal e duplicatas não reexecutam.

## Persistência mínima e segredos

Não são persistidos em claro:

- envelope, authorization, credential ID, nonce ou proof; somente hashes de replay sem material de autenticação são guardados;
- script, prompt, comando, ambiente ou Secret Broker handle;
- stdout/stderr ou resultado completo da execução.

O estado terminal guarda apenas status, exit code, timeout, duplicata e código sanitizado de recusa. Redaction de streams e política de retenção continuam obrigatoriamente em P4 antes de transcript/storage/UI.

## Provas de P2-PR06

As fixtures usam somente diretórios temporários `.morrow` e target nominal fictício `morrow-core`. A suíte demonstra:

- fila offline não chama o executor;
- hello sem heartbeat não declara o Worker online;
- heartbeat vencido ou sessão não anunciada é recusado;
- `busy`/`draining` não iniciam fila, IDs `running` precisam coincidir e lease vencida é conferida também no settlement;
- replay/ordenação continuam bloqueados depois do restart sem persistir nonce/proof em claro;
- resultado com chave idempotente divergente é tratado como resultado incerto;
- reconexão drena pendência em ordem e com idempotency key preservada;
- retry permitido somente após recusa conhecida anterior ao efeito;
- resultado incerto bloqueia e derruba conectividade;
- corrupção/checksum, tamanho, capacidade, concorrência de dois coordenadores e corrida accept/close são fail-closed;
- provas de segurança e saída sensível não chegam ao snapshot;
- processo separado reinicia, retoma `queued` uma vez e não repete `completed`;
- processo é morto depois de gravar o efeito; o restart bloqueia o `running` sem replay.

## Limites preservados

- não há listener, socket, TLS, canal cloud ou conexão outbound concreta nesta PR;
- não há credencial real, Secret Broker material, provider, quota ou cobrança real;
- não há ConPTY, terminal completo, multiplexação ou UI;
- não há eventos/transcript/redaction duráveis de P4;
- cancel/pause coordenados e Job Object continuam nas etapas próprias;
- nenhum target externo é aberto ou executado; Enova permanece proibida.
