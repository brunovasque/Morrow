# Extração de origem — Fase 0

## Regra de segurança

Os repositórios de origem são SOMENTE LEITURA. Não apagar, mover, renomear, commitar, abrir PR ou alterar branches neles durante a extração.

## Fontes identificadas

### Governança e papéis
Origem: `Enova-2`

Peças a estudar e portar de forma genérica:
- `docs/moldes/INVARIANTE_CEREBRO.md`
- `docs/moldes/INVARIANTE_ENSAIADOR.md`
- `docs/moldes/INVARIANTE_EXECUTOR.md`
- `docs/moldes/INVARIANTE_REVISOR.md`
- `docs/moldes/INVARIANTE_AUDITOR.md`
- `docs/moldes/INVARIANTE_ESCRIBA.md`
- `docs/moldes/INVARIANTE_SUPERVISOR.md`
- `docs/moldes/INVARIANTE_LEITURA.md`
- `docs/moldes/MOLDE_DO_CONTRATO.md`
- `docs/moldes/MOLDE_DO_MAPA.md`
- `docs/moldes/MOLDE_DO_PEDIDO.md`
- `docs/moldes/REGISTRO_DE_RECUSAS.md`
- `docs/moldes/MAPA_DE_ERROS_*.md`
- contrato/mapa/dúvidas da frente do loop autônomo como evidência histórica de desenho, não como conteúdo a copiar.

### Runtime/orquestração
Origem: `agente-nexus`

Peças inicialmente identificadas:
- `src/orchestration/spawn-cc.ts`
- `src/mcp/tools/spawn-brain-session.ts`
- `src/mcp/tools/spawn-review-session.ts`
- `src/scheduler/brain-wake.ts`
- `src/storage/brain-wakes.ts`
- `src/storage/locks.ts`
- `src/mcp/tools/manage-brain-wake.ts`
- `src/orchestration/loop.ts` — tratar como possível geração anterior; não assumir como caminho canônico sem confronto com o runtime atual.
- `src/orchestrator/macro-executor.ts` — avaliar antes de definir o kernel vivo.

## O que NÃO copiar para um repositório público

- nomes de clientes, telefones, dados de atendimento ou banco;
- chaves, tokens, IDs de conta e segredos;
- regras específicas de MCMV/Enova que não sejam necessárias ao kernel;
- caminhos locais pessoais;
- contratos de produto da Enova;
- logs ou diagnósticos que exponham arquitetura operacional desnecessária;
- histórico bruto dos mapas de erro da Enova.

O mecanismo dos mapas de erro será portado; o conteúdo histórico não.
