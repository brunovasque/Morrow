# DIAGNÓSTICO — Windows npm shim real vs teste sintético

**Data:** 2026-08-28
**Branch:** `phase-2/runtime-v0`

## Sintoma

`npm run probe:codex-quota` falhou no local-worker Windows com:

```text
windows_npm_shim_unresolved:codex
```

A suíte unitária permanecia verde.

## Causa medida

O parser aceitava uma forma incorreta do marcador de diretório do `cmd.exe`: esperava `%~dp0%`, com `%` final.

O shim npm real usa `%~dp0`, sem `%` final.

O teste sintético reproduzia a mesma suposição incorreta do código e, por isso, não detectava a incompatibilidade com o ambiente real.

## Correção

O parser passa a aceitar explicitamente:

- `%~dp0` — forma real observada nos shims npm modernos;
- `%dp0%` — variante compatível suportada defensivamente.

Ele continua restrito a extrair somente um caminho `.js` relativo ao shim e não executa conteúdo arbitrário de `.cmd`.

## Classificação

- `TOOLING_RUNTIME_COMPATIBILITY`
- `TEST_INSTRUMENT_GAP`

## Aprendizado candidato

Testes de integração de fronteira com executáveis/plataforma não devem depender apenas de fixtures sintéticas quando o artefato real é barato de medir.

Ainda não promover como regra institucional sem observar recorrência em outra fronteira/runtime.
