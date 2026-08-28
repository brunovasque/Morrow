# Target descriptor — morrow-core

## Identidade

- `target_id`: `morrow-core`
- target kind: `existing-repository`
- repository locator: `brunovasque/Morrow` (resolvido pelo control plane; sem credenciais neste arquivo)
- base ref do contrato: `phase-2/runtime-v0`
- pinned baseline SHA: `ff0359c7cdf14735ae6a11dd65c8a82b7d688421`

Cada PR futura registra seu próprio base SHA e candidate SHA em `EVIDENCE.md`. O baseline acima não é movido silenciosamente.

## Política de acesso

- write mode: `pr-only`
- allowed paths: arquivos versionados do repositório Morrow necessários ao PR ativo
- forbidden paths:
  - qualquer diretório `D:\Enova*`;
  - qualquer repositório/target externo não registrado;
  - terminais, perfis PowerShell, home, keyring e projetos do operador;
  - credenciais, tokens e arquivos secretos;
  - `.git` por acesso direto fora de operações Git governadas;
- protected paths: `main`, protected branches, secrets/config privada e memória institucional promovida
- required capabilities: `repo.read`, `repo.write.scoped`, `git.branch`, `git.commit`, `test.run`, `process.spawn.scoped`

## Política de segurança

- required checks:
  - `npm test`;
  - testes focados do PR;
  - `git diff --check`;
  - validação de contrato/status quando implementada;
  - Security Review quando o PR tocar processo, shell, credencial, rede, ConPTY, transcript ou notificação;
- regression profile: todos os testes aceitos da branch + critérios/invariantes afetados do contrato;
- secret profile: nenhuma credencial versionada; redaction antes de stream persistido; keyring somente por broker/worker autorizado;
- deployment policy: nenhum deploy de produção neste contrato; preview/local apenas até capability posterior explícita;
- rollback policy: revert/rollback por PR e artefato reproduzível; nunca force-push destrutivo como caminho normal;
- owner/escalation policy: custo externo, credencial nova, alteração de destino, comportamento remoto sensível e redução de segurança exigem dono.

## Baseline aceito existente

- Event Log JSONL append-only;
- materialização de estado vivo;
- PRE_DISPATCH determinístico;
- grafo com retornos e reunião;
- invalidação de evidência;
- workspace local e Git worktree;
- locks e checkpoints;
- adapter processual provider-neutral;
- adapter Codex quota-session e resolução segura de shim Windows;
- Terminal Session Manager process-backed com streaming, concorrência e isolamento;
- 25 testes passando em `ff0359c` no Windows.

## Superfícies ainda não provadas

- serviço Local Worker persistente;
- ConPTY real;
- rede outbound/reconexão;
- transcript persistente/redaction;
- UI completa;
- Notification Gateway/canal externo;
- Nexus connector;
- fluxo MVO ponta a ponta e instalação fora do harness.

## Isolamento

- workspace strategy: Git worktree/checkout isolado sob raiz gerenciada por contrato/PR/agente;
- lock scope: target + branch/ref + workspace write surface + runtime quota;
- branch naming policy: `mvo/p<fase>-pr<numero>-<slug>`;
- integration base: `phase-2/runtime-v0` até fechamento da Fase 8;
- artifact/log scope: `.morrow`/store externo governado ou diretório de teste; nunca misturar com target do operador;
- PRs futuras não tocam Enova nem usam seus workspaces para prova.
