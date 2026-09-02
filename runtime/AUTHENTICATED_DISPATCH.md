# Dispatch autenticado e execução governada

- contrato: `MORROW-MVO-001`
- etapa: `P2-PR05`
- implementação: [`../src/authenticated-dispatch.ts`](../src/authenticated-dispatch.ts)
- provas: [`../test/authenticated-dispatch.test.ts`](../test/authenticated-dispatch.test.ts)

## Objetivo

P2-PR05 liga a mensagem autenticada do Control Plane à execução local sem permitir que texto de chat, corpo de dispatch ou parâmetro improvisado vire comando. O Local Worker aceita um efeito novo somente quando está `ready` e a composição interna anexou um dispatcher autenticado vivo. Esse poder não existe no arquivo de configuração e é revogado no stop.

Há dois caminhos explícitos:

1. `process`: executa um WorkSpec imutável de PowerShell, sem LLM;
2. `agent`: materializa uma `AgentInstance` e a entrega a um executor governado com routing e recursos resolvidos.

Ambos usam lock por target e workspace dedicado sob a raiz gerenciada do Worker. Nenhum terminal, diretório ou projeto do operador é adotado.

## Sequência mecânica

```text
mensagem bruta
  -> contexto autenticado produzido pelo transporte confiável
  -> validação worker-control/1.0 + autorização por scopes
  -> idempotência local de dispatch/effect
  -> Worker pronto e dispatch habilitado
  -> WorkSpec registrado + hash exato
  -> binding contrato/etapa/target/papel/skill/capabilities/manifest
  -> WorkAuthority resolvida
  -> PRE_DISPATCH
  -> routing + Quota Guard ou Budget Guard, quando for AgentInstance
  -> lock exclusivo do target
  -> workspace dedicado do agente/processo
  -> execução
  -> settlement conservador
  -> remoção do workspace e liberação do lock
```

Qualquer recusa anterior à execução impede a chamada ao executor. Erros de dependências são convertidos em códigos sanitizados; mensagens internas, tokens ou detalhes do processo não atravessam a fronteira.

## WorkSpec imutável

O envelope contém somente `{ artifactId, sha256 }`. O script ou prompt reside no `WorkSpecRegistry`, é validado, clonado, congelado e endereçado por hash canônico. O dispatch não aceita `command`, `script`, `prompt`, `cwd`, ambiente, credencial ou caminho arbitrário.

Reusar `idempotencyKey` ou `dispatchId` com outro corpo é recusado. Repetições concorrentes do mesmo efeito compartilham a mesma operação e o mesmo resultado. A tabela em memória possui capacidade máxima: ao atingir o limite, efeitos novos são recusados sem remover registros anteriores e sem correr o risco de reexecutá-los. P2-PR06 envolve essa tentativa com fila e idempotência duráveis; a semântica de restart está em [`WORKER_RECOVERY.md`](WORKER_RECOVERY.md).

## PowerShell determinístico

`PowerShellProcessExecutor` recebe o executável absoluto por configuração confiável e sempre usa:

- `-NoLogo -NoProfile -NonInteractive -Command -`;
- `shell: false`;
- script imutável pelo `stdin`;
- `cwd` igual ao workspace gerenciado;
- ambiente explícito e sem nomes de variáveis semelhantes a token/segredo/senha/chave;
- timeout e limite de captura de saída.

Falha ao entregar o script pelo stdin também encerra o processo e atravessa a fronteira apenas como erro sanitizado.

Isso prova execução PowerShell direta sem LLM e sem depender de uma janela aberta pelo operador. O workspace dedicado e a ausência de comando vindo do envelope são cercas desta PR; sandbox de sistema operacional, árvore de processos e terminal PTY não são alegados aqui.

## AgentInstance governada

Antes de chamar o executor de agente, o serviço resolve configuração efetiva de runtime, modelo, effort e access mode. Rotas `quota-session` reservam Quota Guard; rotas `api` exigem autorização e reserva no Budget Guard; rotas `local` recusam plano de quota ou budget.

A `AgentInstance` nasce ligada a contrato, etapa, target, papel, runtime, modelo, access mode, manifest e workspace. `terminalSessionId` permanece `null` nesta etapa: P2-PR05 prova a fronteira de execução processual já existente, não a experiência de terminal completo. ConPTY e multiplexação pertencem a P3.

Consumo/custo ausente, inválido ou maior que a reserva não é confiado. O serviço fecha a reserva pelo teto conservador e recusa o resultado do executor. Assim uma resposta hostil não deixa quota ativa nem aumenta cobrança além do valor previamente autorizado.

## Fronteiras preservadas

- nenhuma credencial ou Secret Broker handle é entregue em P2-PR05;
- nenhuma rede, transporte concreto, cobrança real ou API de provider é chamada;
- nenhum target externo é aberto, importado ou executado;
- Enova permanece proibida;
- saída ainda não é persistida nem redigida; essas garantias pertencem a P4;
- ConPTY, input/resize completos e visualização final pertencem a P3-P5;
- fila, checkpoint de dispatch, reconnect, retry seguro e semântica offline são implementados pela fronteira P2-PR06; transporte concreto continua fora desta etapa.

## Provas de P2-PR05

Os testes usam somente targets fictícios em memória e raízes temporárias `.morrow`. Eles demonstram:

- PowerShell real em workspace dedicado e removido após o efeito;
- AgentInstance governada em workspace isolado;
- recusa antes de execução por autenticação, hash, campo de comando bruto, PRE_DISPATCH, Worker parado e lock;
- Quota Guard e Budget Guard bloqueando execução;
- um único efeito para retries concorrentes e recusa de rebinding;
- capacidade de idempotência esgotada recusa efeito novo sem evict/replay;
- settlement conservador para retorno inválido/excessivo;
- liberação de lock/workspace e erro sanitizado após falha do executor.
