# Runtime V0 — Windows workspace boundary finding

## Contexto

Primeiro rerun completo da Phase 2 em um local-worker Windows real.

Ambiente observado:

- Node.js: `v24.14.1`
- npm: `11.11.0`
- Claude Code: `2.1.250`
- Codex CLI: `0.147.0`

## Resultado da suíte antes da correção

`npm test`:

- 11 testes;
- 10 verdes;
- 1 vermelho.

Falha:

`local workspace manager isolates ephemeral workspaces under managed root`

Erro:

`workspace_outside_managed_root`

Origem medida: `LocalWorkspaceManager.destroy()` construía `expectedPrefix` usando `"/"`. Em Windows, `node:path.resolve()` produz caminho com separador `"\\"`, então um workspace legítimo era falsamente classificado como fora da raiz gerenciada.

## Correção

- remover comparação textual dependente de separador;
- resolver a raiz esperada pelo descritor `contractId + workspaceId`;
- comparar caminhos resolvidos de forma case-insensitive no Windows;
- rejeitar IDs com `/`, `\\`, `.`, `..` ou NUL antes de tocar o disco;
- recusar descritor forjado que não aponte exatamente para a raiz calculada.

## Contraprovas adicionadas

1. workspace legítimo pode ser criado/removido de forma cross-platform;
2. traversal-like `../outside` é recusado;
3. traversal-like `..\\outside` é recusado;
4. descritor forjado apontando para outro diretório sob a raiz gerenciada é recusado sem apagar o workspace legítimo.

## Classificação de aprendizado

- classe: portabilidade / boundary validation;
- estado: ocorrência registrada;
- não promover ainda para memória institucional somente por esta ocorrência;
- se o mesmo padrão reaparecer em outros componentes de path/filesystem, avaliar uma CERCA compartilhada de path canonicalization/boundary validation.

## Próxima prova

Rerun completo de `npm test` no mesmo local-worker Windows após atualizar a branch.
