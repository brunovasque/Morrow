# Adendos — MORROW-MVO-001

| addendum_id | requested_by | reason | original_clause | approved_change | impact_on_map | impact_on_regression | owner_approval | effective_at |
|---|---|---|---|---|---|---|---|---|
| `A-001` | Owner — Bruno Vasque | O serviço externo de Security Review exigido para P4-PR02 está indisponível | `TARGET.md`, Política de segurança: Security Review obrigatório para mudança que toca transcript | Exclusivamente para P4-PR02, substituir o gate externo indisponível por revisão local independente de segurança. O revisor e a sessão devem ser distintos do Executor; o checkout deve permanecer somente-leitura; base `3657a070e5dc6b1e7b78fa1804761440c55efffc` e head de código `79382d421a9a6e9df2956007fb701d32d00c5952` ficam fixados; o escopo é transcript/redaction; o relatório deve registrar cobertura, ferramenta, testes, achados, limites e veredito; qualquer P1/P2 bloqueia integração. A substituição não é equivalente ao serviço externo, não certifica as superfícies não medidas e não cria precedente para outra PR. | P4-PR02 permanece `RUNNING`; a revisão local independente passa a ser o gate anterior a merge/regressão pós-merge | Invalida qualquer conclusão de fechamento que presuma o gate externo; preserva candidate/testes existentes e exige relatório local independente fixado aos SHAs | `APPROVED` — autorização explícita do dono em 2026-09-02 | 2026-09-02 |

## Regra

Alterar objetivo mestre, critério de aceitação, exclusão, envelope operacional ou invariante exige linha aprovada aqui. Correção de rota, ordem, tecnologia ou papel permanece no mapa/ADR quando o destino não muda.
