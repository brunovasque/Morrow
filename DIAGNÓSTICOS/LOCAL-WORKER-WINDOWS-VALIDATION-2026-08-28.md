# DIAGNÓSTICO — Local Worker Windows validation

**Data:** 2026-08-28
**Branch:** `phase-2/runtime-v0`
**Ambiente real:** Windows / PowerShell em `D:\Morrow`

## Objetivo

Validar o Runtime V0 completo no primeiro `local-worker` real do operador, após a correção de portabilidade do Workspace Manager.

## Ambiente medido

- Node.js: `v24.14.1`
- npm: `11.11.0`
- Claude Code instalado: `2.1.250`
- Codex CLI instalado: `0.147.0`

## Comando

```powershell
npm test
```

## Resultado

```text
tests 14
pass 14
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 428.8825
```

## Provas verdes

1. Lock Manager concede um owner por vez e rejeita release estrangeiro.
2. Checkpoint Store persiste progresso de invocação através de restart de processo.
3. Git Worktree Manager cria branch/worktree real isolado e remove somente o workspace.
4. Estado vivo do contrato reidrata do Event Log append-only.
5. PRE_DISPATCH bloqueia capability ausente/contrato bloqueado antes do agente.
6. Grafo permite `Review -> Diagnostic -> Execution -> Review/Audit` sem phase lock.
7. Reunião pode abrir durante Review e devolver fluxo a Diagnostic.
8. Mudança de superfície invalida evidência anterior, evitando falso verde.
9. Local Workspace Manager cria/remove workspace legítimo.
10. Process Runtime Adapter entrega prompt por stdin sem acoplamento de provider.
11. Timeout é imposto mecanicamente.
12. Workspace Manager aceita/remova caminho legítimo compatível com Windows.
13. Workspace Manager rejeita identificadores com tentativa de traversal antes de tocar disco.
14. Workspace Manager rejeita descriptor forjado mesmo quando aponta para caminho dentro da raiz gerenciada.

## Regressão observada e corrigida

Na rodada anterior, o teste de workspace local falhou em Windows porque a verificação de boundary usava separador `/` em vez de semântica de caminho portátil. Após a correção, a suíte completa passou 14/14 e contraprovas adicionais de traversal/descriptor forging também ficaram verdes.

## Veredito

**LOCAL_WORKER_WINDOWS_GREEN — 14/14.**

O primeiro worker real confirma o baseline do Runtime V0 em Windows. O próximo gate é validar adapters reais de `quota-session` para Claude Code e Codex, sem fallback silencioso para API.
