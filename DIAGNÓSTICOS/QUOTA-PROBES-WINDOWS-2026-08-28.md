# DIAGNÓSTICO — probes de quota no local-worker Windows

**Data:** 2026-08-28
**Branch:** `phase-2/runtime-v0`
**Worker:** Windows / PowerShell

## Autenticação comprovada

- Claude Code: `Login method: Claude Max account`;
- Codex CLI: `Logged in using ChatGPT`;
- variáveis de API OpenAI/Anthropic verificadas no shell: ausentes;
- Bedrock/Vertex/base URLs alternativos: ausentes.

## Probe Claude

Comando sintético sem tools e effort low foi tentado via `claude -p`.

Resultado observado:

```text
You've hit your weekly limit · resets 1am (America/Sao_Paulo)
```

### Interpretação

O runtime autenticado por Claude Max bloqueou por quota semanal e **não fez fallback silencioso para API**. Isso é evidência positiva para a política `quota-session`: quota esgotada deve produzir bloqueio explícito, não troca automática de modo de cobrança.

O sucesso de transporte/modelo/effort ainda não está provado porque nenhuma inferência foi executada nesta rodada.

## Probe Codex

A tentativa inicial usou:

```text
codex exec --sandbox read-only --ask-for-approval never ...
```

A CLI `0.147.0` rejeitou `--ask-for-approval` nessa posição com `unexpected argument`.

### Estado da arte relevante

Issues recentes do projeto oficial indicam riscos no sandbox/read-only e em sandbox nativo Windows na família `0.147.0`. Portanto o probe de provider não deve usar o checkout do próprio Morrow como superfície de teste.

### Próxima prova

Executar `codex exec` em diretório descartável e independente, com:

- `--ephemeral`;
- `--ignore-user-config`;
- `--ignore-rules`;
- `--skip-git-repo-check`;
- `--sandbox read-only`;
- prompt puramente textual;
- hash/listagem externa antes/depois.

O sandbox do provider é tratado como defesa adicional, não como única cerca de integridade do Morrow.

## Veredito parcial

- **Claude quota authentication: PROVEN**;
- **Claude no silent API fallback on quota exhaustion: PROVEN**;
- **Claude inference transport: BLOCKED_BY_QUOTA**;
- **Codex ChatGPT quota authentication: PROVEN**;
- **Codex exec transport/sandbox: NOT YET PROVEN**.
