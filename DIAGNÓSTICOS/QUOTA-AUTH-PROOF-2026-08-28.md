# DIAGNÓSTICO — autenticação quota-session no local-worker

**Data:** 2026-08-28
**Worker:** Windows / PowerShell em `D:\Morrow`

## Codex

Comando medido:

```text
codex login status
```

Resultado informado pelo operador:

```text
Logged in using ChatGPT
```

Variáveis verificadas como ausentes no ambiente do processo:

- `OPENAI_API_KEY`
- `CODEX_API_KEY`
- `OPENAI_BASE_URL`

**Conclusão:** caminho de autenticação observado = conta ChatGPT / quota-session. Não há evidência de chave API ou endpoint alternativo neste processo.

## Claude Code

Comando medido:

```text
claude auth status --text
```

Resultado informado pelo operador:

```text
Login method: Claude Max account
```

Variáveis verificadas como ausentes no ambiente do processo:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `CLAUDE_CODE_USE_BEDROCK`
- `CLAUDE_CODE_USE_VERTEX`

`claude doctor` também confirmou instalação local funcional da CLI.

**Conclusão:** caminho de autenticação observado = Claude Max / quota-session. Não há evidência de chave API, Bedrock ou Vertex neste processo.

## Limite desta prova

Isto prova **autenticação**, não ainda transporte de prompt, modelo/effort, permissões, timeout, quota/reset ou ausência de fallback em todas as situações de erro.

O próximo gate deve executar probes sintéticos/read-only por adapters específicos de provider e registrar:

- comando/args exatos;
- access mode esperado e efetivo;
- model/effort solicitado e observado quando disponível;
- cwd/workspace;
- stdout/stderr/exit code;
- timeout;
- ausência de mutação;
- comportamento quando a cota/credencial falha;
- confirmação de que API não é acionada silenciosamente.
