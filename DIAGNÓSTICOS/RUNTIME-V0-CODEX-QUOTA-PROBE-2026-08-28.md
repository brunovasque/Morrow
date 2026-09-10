# DIAGNÓSTICO — Codex quota-session probe

**Data:** 2026-08-28
**Worker:** Windows local-worker do operador
**Codex CLI:** 0.147.0

## Pré-condições comprovadas

- `codex login status` retornou `Logged in using ChatGPT`;
- `OPENAI_API_KEY`, `CODEX_API_KEY` e `OPENAI_BASE_URL` ausentes do ambiente;
- execução feita em diretório descartável, fora do checkout do Morrow;
- sentinel criado antes do probe e hash SHA-256 registrado.

## Comando medido

```powershell
codex exec --ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check --sandbox read-only "Responda exatamente: MORROW_CODEX_QUOTA_OK"
```

## Resultado observado

A CLI reportou:

```text
OpenAI Codex v0.147.0
workdir: D:\Morrow-Codex-Probe
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
```

Resposta do modelo:

```text
MORROW_CODEX_QUOTA_OK
```

A execução terminou normalmente e reportou uso de tokens.

## Anti-mutação

Antes:

```text
SHA256 380A3E7E8526BAA48CAE9C1116E88CE1D42CCAEC075361AAF3F2996EC7D96B4F
```

Depois:

```text
SHA256 380A3E7E8526BAA48CAE9C1116E88CE1D42CCAEC075361AAF3F2996EC7D96B4F
```

Conteúdo permaneceu:

```text
MORROW_SENTINEL_ORIGINAL
```

Nenhum arquivo adicional apareceu no diretório.

## Warning observado

Antes da execução, a CLI emitiu:

```text
failed to load models cache: missing field `supports_parallel_tool_calls`
```

A execução, porém, prosseguiu e completou corretamente. O warning fica registrado como achado de compatibilidade/cache da CLI, não como falha do probe.

## Conclusão

**CODEX QUOTA-SESSION READ-ONLY PROBE: GREEN.**

Foi comprovado no worker real:

- autenticação via ChatGPT/cota;
- execução não interativa;
- modelo reportado `gpt-5.6-sol`;
- sandbox `read-only`;
- approval efetivo `never`;
- resposta correta;
- ausência de mutação observável no diretório descartável.

Isso ainda não prova:

- mapping manual de effort;
- comportamento em quota exhaustion;
- escrita governada em workspace autorizado;
- integração com checkpoint/lock do Morrow;
- segurança absoluta do sandbox do provider fora das cercas próprias do kernel.
