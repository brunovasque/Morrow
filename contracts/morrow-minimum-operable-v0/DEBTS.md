# Débitos e expansões deferidas — MORROW-MVO-001

Itens abaixo são reais/possíveis, mas não pertencem ao destino do MVO atual.

| debt_id | found_in_step | description | evidence | relation_to_contract | regression_risk | status | owner_decision | child_execution | date |
|---|---|---|---|---|---|---|---|---|---|
| `D-001` | preflight | suporte PTY completo a macOS/Linux | MVO aceita Windows primeiro | outside-current-contract | portabilidade futura | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-002` | preflight | multi-tenant/múltiplas organizações | envelope define um operador | outside-current-contract | auth/isolamento futuro | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-003` | preflight | aplicativo móvel nativo | canal externo autenticado basta para AC-12 | outside-current-contract | UX futura | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-004` | preflight | cloud worker/alta disponibilidade | MVO é local-first e PC precisa estar ligado | outside-current-contract | durabilidade futura | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-005` | preflight | providers adicionais completos | Codex quota-session fecha primeiro envelope | outside-current-contract | routing futuro | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-006` | preflight | deploy autônomo de produção | MVO encerra em candidato/PR | outside-current-contract | alto risco | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-007` | preflight | routing totalmente automático | exige amostra/métricas após operação | outside-current-contract | qualidade/cota | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-008` | preflight | connectors reais adicionais para GitHub/Vercel/Cloudflare/Supabase e outros | arquitetura/capability registry existem, mas o MVO prova apenas Git local/remoto e Nexus opcional | outside-current-contract | credenciais/produção/provider drift | `DEFERRED_DEBT` | excluído do MVO; cada connector exige contrato próprio | none | 2026-08-28 |
| `D-009` | preflight | control plane/cloud worker híbrido com alta disponibilidade | MVO roda local-first em uma máquina ligada | outside-current-contract | auth/sincronização/custo | `DEFERRED_DEBT` | excluído do MVO | none | 2026-08-28 |
| `D-010` | preflight | produto SaaS, cobrança, marketplace e operação para múltiplos clientes | visão de longo prazo não pertence ao primeiro recorte operável | outside-current-contract | produto/privacidade/compliance | `DEFERRED_DEBT` | exige contrato de produto posterior | none | 2026-08-28 |
| `D-011` | preflight | catálogo amplo de skills/agentes especialistas de engenharia, marketing e domínios | MVO prova extensibilidade e usa apenas papéis/skills necessários ao cenário | outside-current-contract | qualidade/governança do conhecimento | `DEFERRED_DEBT` | adicionar por contratos de extensão | none | 2026-08-28 |
| `D-012` | P3-PR02 | atualizar `node-pty` além da versão exata `1.1.0` | o backend valida a forma interna usada para drenagem e falha fechado diante de drift; o MVO prova somente a versão fixada | outside-current-contract | compatibilidade nativa, drainage e handles | `DEFERRED_DEBT` | qualquer upgrade exige novo probe/contrato e revalidação completa P3 | none | 2026-08-30 |

Achado novo durante execução deve ser acrescentado antes de qualquer implementação lateral.
