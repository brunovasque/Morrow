# Codex quota-session em terminal ConPTY — P3-PR03

- contract: `MORROW-MVO-001`
- PR-ID: `P3-PR03`
- estado: `PROVEN`
- base: `1d40eb717bf4f66cf1d532c498279877ae0ec299`
- candidate de código/teste: `31d2104ed509710431f8486e1f132808e6530dd5`
- hardening de snapshot da invocação: `e4243ba9a04f5440e1eae8815ea4f4038a8ca413`
- hardening de status auth exato: `4b197b0df3367c8ecedcf65b8cab0e01dcbf075f`
- ambiente medido: Windows build `19045` x64, Node `24.14.1`, Codex CLI `0.147.0`

## Resultado

`CodexQuotaConptyAdapter` executa o Codex CLI autenticado por quota ChatGPT dentro de uma sessão `windows-conpty` gerenciada. O adapter não aceita backend de pipes, modo API, provider alternativo ou configuração de processo fornecida por cada invocação.

A execução real mediu:

- `accessMode: quota-session`;
- `provider: openai` e autenticação confirmada por `codex login status` como ChatGPT;
- modelo efetivo `gpt-5.6-sol`;
- `approval: never`, `sandbox: read-only` e reasoning effort efetivo `none`;
- backend `windows-conpty`, protocolo `conpty-vt` e apresentação `full-terminal`;
- eventos de output da sessão principal antes da conclusão;
- cwd exatamente igual ao workspace gerenciado;
- resposta esperada, exit `0` e nenhuma mutação da fixture.

Os valores de modelo e effort acima são medidos, não fixados pelo adapter. A política de routing escolhe o runtime; o header da CLI registra o que foi efetivamente usado.

## Fluxo fechado

```text
runtime confiável cria adapter
  → snapshot mínimo de ambiente e comando
  → recusa qualquer variável que habilite API/base URL
  → exige descriptor ConPTY completo antes de spawn
  → sessão auth gerenciada executa somente `codex login status`
  → exige linha exata “Logged in using ChatGPT” e exit 0
  → sessão principal executa `codex exec` efêmero/read-only
  → stream ConPTY produz eventos ao vivo vinculados às identidades
  → header da própria CLI fornece versão/model/provider/políticas
  → exit e resultado preservam terminal/agente/contrato/runtime/workspace
```

Não existe busca de outro provider, runtime, modo de acesso ou backend. Falha de autenticação, metadata, política ou capability encerra a rota com erro estável.

## Ambiente e autenticação

O ambiente do runtime é capturado no construtor do adapter, antes de qualquer invocação, e reduzido a uma allowlist de caminhos do sistema, diretórios de perfil necessários à sessão Codex, `CODEX_HOME` quando configurado e PATH para a resolução segura do shim instalado. Valores arbitrários do dispatch não atravessam a fronteira; mutar o objeto de configuração depois da construção não rebinda a sessão. Cada invocação também é destacada antes do primeiro `await`, impedindo troca tardia de prompt, identidades ou workspace durante o preflight.

`OPENAI_API_KEY`, `CODEX_API_KEY` e `OPENAI_BASE_URL` são recusados sem depender de caixa. A prova não lê arquivo de autenticação, não imprime token e não entrega material de credencial ao prompt. A própria CLI usa sua sessão local e só uma linha exatamente positiva “Logged in using ChatGPT” é aceita; texto negativo contendo a mesma substring falha fechado mesmo com exit `0`.

## Prompt e eventos

O teste real mostrou que `codex exec -` não recebe EOF confiável ao fechar input sob ConPTY. Por isso P3-PR03 preserva o transporte não interativo medido pelo CLI: o prompt é o último argumento real de `codex exec`.

Antes do processo iniciar, `TerminalSessionManager` valida e destaca `sensitiveArgIndexes`. No evento `TERMINAL_SESSION_STARTED`, o índice do prompt aparece somente como `[REDACTED]`; mutações posteriores do request não conseguem trocar o argumento nem remover a redaction. Nenhum evento de input persiste o texto.

O próprio terminal do agente pode ecoar o prompt como parte do output humano da CLI. P3-PR03 usa apenas prompt não sensível na prova. Redaction de stream antes de persistência/exibição pertence obrigatoriamente à P4-PR02; segredos continuam proibidos em prompts e provas.

## Metadata resistente a output hostil

Modelo, provider, approval, sandbox, effort e versão são extraídos somente do header delimitado que segue o banner semver `OpenAI Codex v...`. Linhas iguais produzidas depois pela resposta do agente não podem sobrescrever o header. O normalizador remove controle VT e tolera redraw do banner e wrap de linhas longas sem inventar valores.

O adapter exige `provider: openai`, `approval: never` e `sandbox: read-only`. Campo ausente ou divergente falha fechado.

## Provas e contraprovas

- `npm run probe:codex-conpty`: sessão real verde, metadata completa, output ao vivo, cwd vinculado e fixture intacta;
- `npm run probe:codex-quota`: adapter baseline por pipes permaneceu verde;
- `npm run probe:conpty`: `5/5`;
- `npm test`: `155/155`;
- fixture controlada prova auth ausente, API em caixa alternativa, backend pipes, ambiente canário, mutação tardia, spoof de metadata e redaction do prompt;
- nenhum target externo, repositório do operador ou material de credencial foi usado como fixture.

## Limites

- quota restante/reset não é inventada porque a CLI medida não a expôs de forma confiável;
- ConPTY e sandbox read-only do CLI não transformam o processo em sandbox geral do sistema;
- timeout/cancel concorrente, colisões e múltiplas sessões pertencem à P3-PR04;
- redaction/persistência/replay pertencem à P4;
- routing multi-role e execução completa do contrato pertencem à P7.
